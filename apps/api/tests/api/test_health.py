from app.platform.health import HealthCheck, HealthResponse
from fast_core.settings import settings
from fastapi.testclient import TestClient


def ok_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        checks=[
            HealthCheck(name="database", status="ok"),
            HealthCheck(name="migration", status="ok", detail="head"),
            HealthCheck(name="redis", status="ok"),
        ],
    )


def error_health(
    checks: list[HealthCheck],
) -> HealthResponse:
    return HealthResponse(status="error", checks=checks)


def test_livez(client: TestClient) -> None:
    response = client.get(f"{settings.API_PREFIX}/livez")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readyz_success(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    async def stub_cached_readiness_response(**_kwargs) -> HealthResponse:
        return ok_health()

    monkeypatch.setattr(
        health,
        "cached_readiness_response",
        stub_cached_readiness_response,
    )

    response = client.get(f"{settings.API_PREFIX}/readyz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert [check["name"] for check in body["checks"]] == [
        "database",
        "migration",
        "redis",
    ]


def test_readyz_database_failure(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    async def stub_cached_readiness_response(**_kwargs) -> HealthResponse:
        return error_health(
            [
                HealthCheck(name="database", status="error", detail="db down"),
                HealthCheck(name="migration", status="error", detail="Skipped"),
                HealthCheck(name="redis", status="ok"),
            ]
        )

    monkeypatch.setattr(
        health,
        "cached_readiness_response",
        stub_cached_readiness_response,
    )

    response = client.get(f"{settings.API_PREFIX}/readyz")

    assert response.status_code == 503
    assert response.json()["status"] == "error"


def test_readyz_migration_failure(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    async def stub_cached_readiness_response(**_kwargs) -> HealthResponse:
        return error_health(
            [
                HealthCheck(name="database", status="ok"),
                HealthCheck(name="migration", status="error", detail="missing"),
                HealthCheck(name="redis", status="ok"),
            ]
        )

    monkeypatch.setattr(
        health,
        "cached_readiness_response",
        stub_cached_readiness_response,
    )

    response = client.get(f"{settings.API_PREFIX}/readyz")

    assert response.status_code == 503
    assert response.json()["status"] == "error"


def test_readyz_database_exception(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    async def stub_cached_readiness_response(**_kwargs) -> HealthResponse:
        return error_health(
            [
                HealthCheck(
                    name="database",
                    status="error",
                    detail="Database unavailable",
                ),
                HealthCheck(name="migration", status="error", detail="Skipped"),
                HealthCheck(name="redis", status="ok"),
            ]
        )

    monkeypatch.setattr(
        health,
        "cached_readiness_response",
        stub_cached_readiness_response,
    )

    response = client.get(f"{settings.API_PREFIX}/readyz")

    assert response.status_code == 503
    assert response.json()["checks"][0]["detail"] == "Database unavailable"


def test_readyz_redis_failure(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    async def stub_cached_readiness_response(**_kwargs) -> HealthResponse:
        return error_health(
            [
                HealthCheck(name="database", status="ok"),
                HealthCheck(name="migration", status="ok", detail="head"),
                HealthCheck(name="redis", status="error", detail="Redis unavailable"),
            ]
        )

    monkeypatch.setattr(
        health,
        "cached_readiness_response",
        stub_cached_readiness_response,
    )

    response = client.get(f"{settings.API_PREFIX}/readyz")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "error"
    assert body["checks"][2] == {
        "name": "redis",
        "status": "error",
        "detail": "Redis unavailable",
    }
