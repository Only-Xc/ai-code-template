import uuid
from typing import Any

from fast_core.openapi import merge_common_error_responses
from fast_core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from fastapi import APIRouter, Depends, Query

from fast_auth.deps import (
    CurrentUserDep,
    UserServiceDep,
    get_current_active_superuser,
)
from fast_auth.schemas import (
    Message,
    UpdatePassword,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses=merge_common_error_responses(),
)


@router.get(
    "/",
    response_model=UsersPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    *,
    user_service: UserServiceDep,
) -> Any:
    """
    Retrieve users.
    """
    return user_service.list_users(skip=skip, limit=limit)


@router.post(
    "/",
    response_model=UserPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_user(
    user_in: UserCreate,
    user_service: UserServiceDep,
) -> Any:
    """
    Create new user.
    """
    return user_service.create_user(user_in=user_in)


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    user_in: UserUpdateMe,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> Any:
    """
    Update own user.
    """
    return user_service.update_me(current_user=current_user, user_in=user_in)


@router.patch("/me/password", response_model=Message)
def update_password_me(
    body: UpdatePassword,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> Any:
    """
    Update own password.
    """
    return user_service.update_my_password(current_user=current_user, body=body)


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUserDep) -> Any:
    """
    Get current user.
    """
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> Any:
    """
    Delete own user.
    """
    return user_service.delete_me(current_user=current_user)


@router.post("/signup", response_model=UserPublic)
def register_user(
    user_in: UserRegister,
    user_service: UserServiceDep,
) -> Any:
    """
    Create new user without the need to be logged in.
    """
    return user_service.register_user(user_in=user_in)


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> Any:
    """
    Get a specific user by id.
    """
    return user_service.get_visible_user(
        user_id=user_id,
        current_user=current_user,
    )


@router.patch(
    "/{user_id}",
    response_model=UserPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_user(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    user_service: UserServiceDep,
) -> Any:
    """
    Update a user.
    """
    return user_service.update_user_by_id(user_id=user_id, user_in=user_in)


@router.delete(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_user(
    user_id: uuid.UUID,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> Message:
    """
    Delete a user.
    """
    return user_service.delete_user_by_id(
        user_id=user_id,
        current_user=current_user,
    )
