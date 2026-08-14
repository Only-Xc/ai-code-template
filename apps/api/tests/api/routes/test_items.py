import uuid

from fast_core.settings import settings
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.utils.item import create_random_item
from tests.utils.utils import assert_error_detail


def test_create_item(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Foo", "description": "Fighters"}
    response = client.post(
        f"{settings.API_PREFIX}/v1/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert "id" in content
    assert "owner_id" in content


def test_read_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_PREFIX}/v1/items/{item.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == item.title
    assert content["description"] == item.description
    assert content["id"] == str(item.id)
    assert content["owner_id"] == str(item.owner_id)


def test_read_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_PREFIX}/v1/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert_error_detail(content, detail="Item not found")


def test_read_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_PREFIX}/v1/items/{item.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert_error_detail(content, detail="Not enough permissions")


def test_read_items(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_item(db)
    create_random_item(db)
    response = client.get(
        f"{settings.API_PREFIX}/v1/items/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2
    assert content["count"] >= 2


def test_read_items_rejects_too_large_limit(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_PREFIX}/v1/items/?limit=101",
        headers=superuser_token_headers,
    )

    assert response.status_code == 422


def test_read_items_sorts_by_title(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_item(db)
    first = client.post(
        f"{settings.API_PREFIX}/v1/items/",
        headers=superuser_token_headers,
        json={"title": "AAA item", "description": "sort"},
    ).json()
    second = client.post(
        f"{settings.API_PREFIX}/v1/items/",
        headers=superuser_token_headers,
        json={"title": "ZZZ item", "description": "sort"},
    ).json()

    response = client.get(
        f"{settings.API_PREFIX}/v1/items/?sort=title:asc&limit=100",
        headers=superuser_token_headers,
    )

    titles = [item["title"] for item in response.json()["data"]]
    assert titles.index(first["title"]) < titles.index(second["title"])


def test_read_items_filters_by_title(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    client.post(
        f"{settings.API_PREFIX}/v1/items/",
        headers=superuser_token_headers,
        json={"title": "Needle item", "description": "filter"},
    )
    client.post(
        f"{settings.API_PREFIX}/v1/items/",
        headers=superuser_token_headers,
        json={"title": "Haystack item", "description": "filter"},
    )

    response = client.get(
        f"{settings.API_PREFIX}/v1/items/?title=Needle",
        headers=superuser_token_headers,
    )

    titles = [item["title"] for item in response.json()["data"]]
    assert "Needle item" in titles
    assert "Haystack item" not in titles


def test_read_items_rejects_unknown_sort_field(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_PREFIX}/v1/items/?sort=owner_id:asc",
        headers=superuser_token_headers,
    )

    assert response.status_code == 400


def test_update_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_PREFIX}/v1/items/{item.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert content["id"] == str(item.id)
    assert content["owner_id"] == str(item.owner_id)


def test_update_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_PREFIX}/v1/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 404
    content = response.json()
    assert_error_detail(content, detail="Item not found")


def test_update_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_PREFIX}/v1/items/{item.id}",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 403
    content = response.json()
    assert_error_detail(content, detail="Not enough permissions")


def test_delete_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.delete(
        f"{settings.API_PREFIX}/v1/items/{item.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Item deleted successfully"


def test_delete_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_PREFIX}/v1/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert_error_detail(content, detail="Item not found")


def test_delete_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.delete(
        f"{settings.API_PREFIX}/v1/items/{item.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert_error_detail(content, detail="Not enough permissions")
