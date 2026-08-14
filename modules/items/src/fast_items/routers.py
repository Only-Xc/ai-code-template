import uuid
from typing import Any

from fast_auth.public import CurrentUserDep
from fast_core.openapi import merge_common_error_responses
from fast_core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from fastapi import APIRouter, Query

from fast_items.deps import ItemServiceDep
from fast_items.schemas import ItemCreate, ItemPublic, ItemsPublic, ItemUpdate, Message

router = APIRouter(
    prefix="/items",
    tags=["items"],
    responses=merge_common_error_responses(),
)


@router.get("/", response_model=ItemsPublic)
def read_items(
    current_user: CurrentUserDep,
    item_service: ItemServiceDep,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    sort: str | None = Query(default=None),
    title: str | None = Query(default=None, min_length=1),
) -> Any:
    """
    Retrieve items.
    """
    return item_service.list_items(
        current_user_id=current_user.id,
        is_superuser=current_user.is_superuser,
        skip=skip,
        limit=limit,
        sort=sort,
        title=title,
    )


@router.get("/{id}", response_model=ItemPublic)
def read_item(
    id: uuid.UUID,
    current_user: CurrentUserDep,
    item_service: ItemServiceDep,
) -> Any:
    """
    Get item by ID.
    """
    return item_service.get_item(
        current_user_id=current_user.id,
        is_superuser=current_user.is_superuser,
        item_id=id,
    )


@router.post("/", response_model=ItemPublic)
def create_item(
    item_in: ItemCreate,
    current_user: CurrentUserDep,
    item_service: ItemServiceDep,
) -> Any:
    """
    Create new item.
    """
    return item_service.create_item(current_user_id=current_user.id, item_in=item_in)


@router.put("/{id}", response_model=ItemPublic)
def update_item(
    id: uuid.UUID,
    item_in: ItemUpdate,
    current_user: CurrentUserDep,
    item_service: ItemServiceDep,
) -> Any:
    """
    Update an item.
    """
    return item_service.update_item(
        current_user_id=current_user.id,
        is_superuser=current_user.is_superuser,
        item_id=id,
        item_in=item_in,
    )


@router.delete("/{id}")
def delete_item(
    id: uuid.UUID,
    current_user: CurrentUserDep,
    item_service: ItemServiceDep,
) -> Message:
    """
    Delete an item.
    """
    return item_service.delete_item(
        current_user_id=current_user.id,
        is_superuser=current_user.is_superuser,
        item_id=id,
    )
