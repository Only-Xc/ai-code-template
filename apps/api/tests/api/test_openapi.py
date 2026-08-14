from app.api_router import api_router
from app.bootstrap import create_app
from app.platform.openapi import HEALTH_OPENAPI_TAGS, OPENAPI_TAGS
from fast_auth.openapi import AUTH_OPENAPI_TAGS
from fast_items.module import items_module
from fast_items.openapi import ITEMS_OPENAPI_TAGS


def test_openapi_tags_are_declared() -> None:
    schema = create_app(router=api_router).openapi()

    tag_names = [tag["name"] for tag in schema["tags"]]

    assert tag_names == [tag["name"] for tag in OPENAPI_TAGS]


def test_platform_openapi_tags_are_composed_from_modules() -> None:
    assert OPENAPI_TAGS == [
        *AUTH_OPENAPI_TAGS,
        *ITEMS_OPENAPI_TAGS,
        *HEALTH_OPENAPI_TAGS,
    ]


def test_items_module_openapi_tags_are_module_scoped() -> None:
    schema = create_app(
        router=items_module.router,
        title="fast-items-api",
        openapi_tags=ITEMS_OPENAPI_TAGS,
    ).openapi()

    assert [tag["name"] for tag in schema["tags"]] == ["items"]
    assert "/api/v1/items/" in schema["paths"]
    assert "/api/readyz" not in schema["paths"]


def test_openapi_operation_ids_are_unique_and_stable() -> None:
    schema = create_app(router=api_router).openapi()
    operation_ids = [
        method["operationId"]
        for path in schema["paths"].values()
        for method in path.values()
        if isinstance(method, dict)
    ]

    assert len(operation_ids) == len(set(operation_ids))
    assert "items-read_items" in operation_ids
    assert "users-read_users" in operation_ids


def test_openapi_common_error_responses_are_documented() -> None:
    schema = create_app(router=api_router).openapi()
    responses = schema["paths"]["/api/v1/items/"]["get"]["responses"]

    assert "400" in responses
    assert "401" in responses
    assert "429" in responses
    assert "500" in responses


def test_schema_names_remain_stable() -> None:
    schema = create_app(router=api_router).openapi()
    schemas = schema["components"]["schemas"]

    assert "ItemsPublic" in schemas
    assert "UsersPublic" in schemas
