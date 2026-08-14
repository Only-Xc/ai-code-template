import pytest
from fast_core.deps import get_object_storage
from starlette.requests import Request


def make_request(state: dict[str, object]) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "app": type("FakeApp", (), {"state": type("State", (), state)()})(),
        }
    )


def test_get_object_storage_returns_app_state_resource() -> None:
    object_storage = object()
    request = make_request({"object_storage": object_storage})

    assert get_object_storage(request) is object_storage


def test_get_object_storage_reports_missing_app_state_resource() -> None:
    request = make_request({})

    with pytest.raises(RuntimeError, match="app.state.object_storage"):
        get_object_storage(request)
