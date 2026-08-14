from typing import Any

from app.bootstrap import create_app
from app.platform.rate_limit import create_rate_limit_middleware
from fast_core.settings import settings
from fastapi import FastAPI
from fastapi.testclient import TestClient


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, int] = {}
        self.expires: dict[str, int] = {}

    def pipeline(self, *, transaction: bool) -> "FakeRedisPipeline":
        return FakeRedisPipeline(self, transaction=transaction)

    async def incrby(self, key: str, amount: int) -> int:
        self.values[key] = self.values.get(key, 0) + amount
        return self.values[key]

    async def ttl(self, key: str) -> int:
        return self.expires.get(key, -1)

    async def expire(self, key: str, ttl_seconds: int) -> bool:
        self.expires[key] = ttl_seconds
        return True


class FakeRedisPipeline:
    def __init__(self, redis: FakeRedis, *, transaction: bool) -> None:
        self.redis = redis
        self.is_transaction = transaction
        self.commands: list[tuple[str, tuple[Any, ...]]] = []

    async def __aenter__(self) -> "FakeRedisPipeline":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    def incrby(self, key: str, amount: int) -> None:
        self.commands.append(("incrby", (key, amount)))

    def ttl(self, key: str) -> None:
        self.commands.append(("ttl", (key,)))

    async def execute(self) -> list[Any]:
        results: list[Any] = []
        for command, args in self.commands:
            method = getattr(self.redis, command)
            results.append(await method(*args))
        return results


def make_rate_limited_app() -> FastAPI:
    app = FastAPI()
    app.state.redis = FakeRedis()
    app.state.calls = 0
    app.middleware("http")(
        create_rate_limit_middleware(
            max_requests=2,
            window_seconds=60,
            paths={"/limited"},
        )
    )

    @app.post("/limited")
    def limited() -> dict[str, bool]:
        app.state.calls += 1
        return {"ok": True}

    return app


def test_security_headers_are_applied(client: TestClient) -> None:
    response = client.get(f"{settings.API_PREFIX}/livez")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "geolocation=()" in response.headers["Permissions-Policy"]
    assert (
        response.headers["Strict-Transport-Security"]
        == "max-age=63072000; includeSubDomains"
    )
    assert response.headers["Content-Security-Policy"] == (
        "default-src 'none'; frame-ancestors 'none'"
    )


def test_docs_skip_content_security_policy(monkeypatch) -> None:
    monkeypatch.setattr("app.bootstrap.settings.ENVIRONMENT", "development")
    isolated_client = TestClient(create_app())

    response = isolated_client.get("/docs")

    assert response.status_code == 200
    assert "X-Content-Type-Options" not in response.headers
    assert "X-Frame-Options" not in response.headers
    assert "Referrer-Policy" not in response.headers
    assert "Permissions-Policy" not in response.headers
    assert "Strict-Transport-Security" not in response.headers
    assert "Content-Security-Policy" not in response.headers


def test_rate_limit_blocks_before_route_handler() -> None:
    app = make_rate_limited_app()

    with TestClient(app) as isolated_client:
        assert isolated_client.post("/limited").status_code == 200
        assert isolated_client.post("/limited").status_code == 200
        response = isolated_client.post("/limited")

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many requests"}
    assert app.state.calls == 2
