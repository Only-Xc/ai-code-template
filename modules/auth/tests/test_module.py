from fast_auth.module import create_auth_module
from fastapi import FastAPI


def route_paths(module) -> set[str]:
    app = FastAPI()
    app.include_router(module.router)
    paths: set[str] = set()
    routes = list(app.routes)
    while routes:
        route = routes.pop()
        path = getattr(route, "path", None)
        if isinstance(path, str):
            paths.add(path)
        original_router = getattr(route, "original_router", None)
        if original_router is not None:
            routes.extend(original_router.routes)
    return paths


def test_auth_module_includes_public_auth_routes() -> None:
    module = create_auth_module()

    paths = route_paths(module)
    assert module.router.prefix == "/v1"
    assert "/login/access-token" in paths
    assert "/login/refresh-token" in paths
    assert "/logout" in paths
    assert "/users/" in paths
    assert "/utils/test-email/" in paths
