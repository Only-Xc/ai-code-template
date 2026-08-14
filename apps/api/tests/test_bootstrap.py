from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import pytest
from app.api_router import api_router
from app.bootstrap import create_app
from fast_items.module import items_module
from fastapi.testclient import TestClient


def route_paths(app: Any) -> set[str]:
    return set(app.openapi()["paths"])


class FakeEngine:
    def __init__(self) -> None:
        self.disposed = False

    def dispose(self) -> None:
        self.disposed = True


class FakeRedis:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True


@contextmanager
def patch_lifespan_resources(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[dict[str, Any]]:
    resources: dict[str, Any] = {
        "engine": FakeEngine(),
        "redis": FakeRedis(),
        "object_storage": object(),
    }

    monkeypatch.setattr(
        "app.bootstrap.create_engine_from_settings",
        lambda _settings: resources["engine"],
    )
    monkeypatch.setattr(
        "app.bootstrap.create_redis",
        lambda _settings: resources["redis"],
    )
    monkeypatch.setattr(
        "app.bootstrap.create_object_storage",
        lambda _settings: resources["object_storage"],
    )
    yield resources


def test_lifespan_initializes_object_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    with patch_lifespan_resources(monkeypatch) as resources:
        app = create_app(router=api_router)
        with TestClient(app):
            assert app.state.engine is resources["engine"]
            assert app.state.redis is resources["redis"]
            assert app.state.object_storage is resources["object_storage"]
            assert app.state.readiness_cache is not None

    assert resources["engine"].disposed
    assert resources["redis"].closed


def test_api_docs_are_enabled_outside_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.bootstrap.settings.ENVIRONMENT", "development")

    app = create_app()

    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"
    assert app.openapi_url == "/api/openapi.json"


def test_api_docs_are_disabled_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.bootstrap.settings.ENVIRONMENT", "production")

    app = create_app()

    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None


def test_create_app_can_mount_single_module_router() -> None:
    app = create_app(router=items_module.router, title="fast-items-api")

    paths = route_paths(app)

    assert app.title == "fast-items-api"
    assert "/api/v1/items/" in paths
    assert "/api/readyz" not in paths
    assert "/api/v1/login/access-token" not in paths


def test_create_app_without_router_does_not_register_api_routes() -> None:
    app = create_app()

    paths = route_paths(app)

    assert "/api/v1/items/" not in paths
    assert "/api/readyz" not in paths


def test_default_app_uses_router_level_versioning() -> None:
    app = create_app(router=api_router)

    paths = route_paths(app)

    assert "/api/v1/login/access-token" in paths
    assert "/api/v1/items/" in paths
    assert "/api/readyz" in paths
    assert "/api/login/access-token" not in paths
    assert "/api/items/" not in paths
