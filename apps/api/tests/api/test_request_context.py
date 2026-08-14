from fast_core.settings import settings
from fastapi.testclient import TestClient


def test_response_contains_generated_request_id(client: TestClient) -> None:
    response = client.get(f"{settings.API_PREFIX}/livez")

    assert response.headers["X-Request-ID"]


def test_response_preserves_incoming_request_id(client: TestClient) -> None:
    response = client.get(
        f"{settings.API_PREFIX}/livez",
        headers={"X-Request-ID": "request-123"},
    )

    assert response.headers["X-Request-ID"] == "request-123"


def test_request_ids_do_not_leak_between_requests(client: TestClient) -> None:
    first = client.get(
        f"{settings.API_PREFIX}/livez",
        headers={"X-Request-ID": "request-a"},
    )
    second = client.get(
        f"{settings.API_PREFIX}/livez",
        headers={"X-Request-ID": "request-b"},
    )

    assert first.headers["X-Request-ID"] == "request-a"
    assert second.headers["X-Request-ID"] == "request-b"
