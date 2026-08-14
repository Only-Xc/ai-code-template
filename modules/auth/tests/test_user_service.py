import uuid
from typing import cast

import pytest
from fast_auth.repositories.user_repository import UserRepository
from fast_auth.schemas import UserCreate, UserUpdateMe
from fast_auth.services.user_service import UserService
from fast_core.errors import BadRequestError, ConflictError, ForbiddenError
from sqlmodel import Session

from .fakes import FakeSession, FakeSettings, make_user


class FakeUsers:
    def __init__(self, user=None):
        self.user = user

    def get_by_email(self, *, email: str):
        if self.user and self.user.email == email:
            return self.user
        return None

    def get(self, user_id):
        if self.user and self.user.id == user_id:
            return self.user
        return None

    def create(self, *, user_create: UserCreate, hashed_password: str):
        return make_user(email=user_create.email, password=user_create.password)


def make_service(fake_users: FakeUsers) -> UserService:
    return UserService(
        cast(Session, FakeSession()),
        settings=FakeSettings(),
        send_email=lambda **_: None,
        users=cast(UserRepository, fake_users),
    )


def test_create_user_rejects_duplicate_email() -> None:
    service = make_service(FakeUsers(make_user(email="user@example.com")))

    with pytest.raises(BadRequestError, match="already exists"):
        service.create_user(
            user_in=UserCreate(email="user@example.com", password="password123")
        )


def test_update_me_rejects_duplicate_email() -> None:
    current_user = make_user(email="current@example.com")
    other_user = make_user(email="other@example.com")
    service = make_service(FakeUsers(other_user))

    with pytest.raises(ConflictError, match="already exists"):
        service.update_me(
            current_user=current_user,
            user_in=UserUpdateMe(email="other@example.com"),
        )


def test_delete_me_rejects_superuser_self_delete() -> None:
    service = make_service(FakeUsers())

    with pytest.raises(ForbiddenError, match="Super users are not allowed"):
        service.delete_me(current_user=make_user(is_superuser=True))


def test_get_visible_user_rejects_non_superuser_for_other_user() -> None:
    target_user = make_user(email="target@example.com")
    target_user.id = uuid.uuid4()
    current_user = make_user(email="current@example.com")
    current_user.id = uuid.uuid4()
    service = make_service(FakeUsers(target_user))

    with pytest.raises(ForbiddenError, match="enough privileges"):
        service.get_visible_user(user_id=target_user.id, current_user=current_user)
