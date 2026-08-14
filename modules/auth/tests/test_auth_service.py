from typing import Any, cast

import anyio
import pytest
from fast_auth.repositories.user_repository import UserRepository
from fast_auth.schemas import UserUpdate
from fast_auth.services.auth_service import AuthService
from fast_auth.tokens import generate_password_reset_token
from fast_core.errors import BadRequestError, NotFoundError, UnauthorizedError
from sqlmodel import Session

from .fakes import FakeSession, FakeSettings, make_user


class FakeUsers:
    def __init__(self, user=None):
        self.user = user
        self.updated_user = None

    def get_by_email(self, *, email: str):
        if self.user and self.user.email == email:
            return self.user
        return None

    def get(self, user_id):
        if self.user and str(self.user.id) == str(user_id):
            return self.user
        return None

    def update_with_extra(self, *, db_user, user_in: UserUpdate, extra_data: dict):
        db_user.sqlmodel_update(
            user_in.model_dump(exclude_unset=True), update=extra_data
        )
        self.updated_user = db_user
        return db_user


class FakeCache:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.deleted: list[str] = []
        self.ttls: dict[str, int] = {}

    async def set_text(
        self,
        key: str,
        value: str,
        *,
        ttl_seconds: int | None = None,
    ) -> None:
        self.values[key] = value
        if ttl_seconds is not None:
            self.ttls[key] = ttl_seconds

    async def get_text(self, key: str) -> str | None:
        return self.values.get(key)

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            self.deleted.append(key)
            if key in self.values:
                deleted += 1
                del self.values[key]
        return deleted


def make_session() -> Session:
    return cast(Session, FakeSession())


def test_create_access_token_for_login_rejects_bad_password() -> None:
    service = AuthService(
        make_session(),
        settings=FakeSettings(),
        send_email=lambda **_: None,
        users=cast(UserRepository, FakeUsers(make_user(password="correct-password"))),
    )

    with pytest.raises(BadRequestError, match="Incorrect email or password"):
        service.create_access_token_for_login(
            email="user@example.com", password="wrong-password"
        )


def test_create_access_token_for_login_rejects_inactive_user() -> None:
    service = AuthService(
        make_session(),
        settings=FakeSettings(),
        send_email=lambda **_: None,
        users=cast(
            UserRepository,
            FakeUsers(make_user(password="password123", is_active=False)),
        ),
    )

    with pytest.raises(BadRequestError, match="Inactive user"):
        service.create_access_token_for_login(
            email="user@example.com", password="password123"
        )


def test_create_token_for_login_issues_refresh_token() -> None:
    async def run() -> None:
        cache = FakeCache()
        service = AuthService(
            make_session(),
            settings=FakeSettings(),
            send_email=lambda **_: None,
            cache=cast(Any, cache),
            users=cast(UserRepository, FakeUsers(make_user(password="password123"))),
        )

        token = await service.create_token_for_login(
            email="user@example.com", password="password123"
        )

        assert token.access_token
        assert token.refresh_token
        assert cache.values[service._refresh_token_key(token.refresh_token)]

    anyio.run(run)


def test_refresh_access_token_rotates_refresh_token() -> None:
    async def run() -> None:
        cache = FakeCache()
        user = make_user(password="password123")
        service = AuthService(
            make_session(),
            settings=FakeSettings(),
            send_email=lambda **_: None,
            cache=cast(Any, cache),
            users=cast(UserRepository, FakeUsers(user)),
        )
        old_refresh_token = "refresh-1"
        cache.values[service._refresh_token_key(old_refresh_token)] = str(user.id)

        token = await service.refresh_access_token(refresh_token=old_refresh_token)

        assert token.access_token
        assert token.refresh_token != old_refresh_token
        assert service._refresh_token_key(old_refresh_token) in cache.deleted
        assert service._refresh_token_key(token.refresh_token) in cache.values

    anyio.run(run)


def test_refresh_access_token_rejects_missing_token() -> None:
    async def run() -> None:
        service = AuthService(
            make_session(),
            settings=FakeSettings(),
            send_email=lambda **_: None,
            cache=cast(Any, FakeCache()),
            users=cast(UserRepository, FakeUsers(make_user())),
        )

        with pytest.raises(UnauthorizedError, match="Invalid refresh token"):
            await service.refresh_access_token(refresh_token="missing")

    anyio.run(run)


def test_get_user_from_token_rejects_invalid_token_as_unauthorized() -> None:
    service = AuthService(
        make_session(),
        settings=FakeSettings(),
        send_email=lambda **_: None,
        users=cast(UserRepository, FakeUsers(make_user())),
    )

    with pytest.raises(UnauthorizedError, match="Could not validate credentials"):
        service.get_user_from_token("invalid-token")


def test_logout_revokes_refresh_token() -> None:
    async def run() -> None:
        cache = FakeCache()
        service = AuthService(
            make_session(),
            settings=FakeSettings(),
            send_email=lambda **_: None,
            cache=cast(Any, cache),
            users=cast(UserRepository, FakeUsers(make_user())),
        )
        refresh_token_key = service._refresh_token_key("refresh-1")
        cache.values[refresh_token_key] = "user-id"

        result = await service.logout(refresh_token="refresh-1")

        assert result.message == "Logged out successfully"
        assert refresh_token_key in cache.deleted
        assert refresh_token_key not in cache.values

    anyio.run(run)


def test_send_password_recovery_email_does_not_leak_missing_user() -> None:
    sent = []
    service = AuthService(
        make_session(),
        settings=FakeSettings(SMTP_HOST="smtp.example.com"),
        send_email=lambda **kwargs: sent.append(kwargs),
        users=cast(UserRepository, FakeUsers(None)),
    )

    result = service.send_password_recovery_email(email="missing@example.com")

    assert (
        result.message
        == "If that email is registered, we sent a password recovery link"
    )
    assert sent == []


def test_reset_password_rejects_invalid_token() -> None:
    service = AuthService(
        make_session(),
        settings=FakeSettings(),
        send_email=lambda **_: None,
        users=cast(UserRepository, FakeUsers(make_user())),
    )

    with pytest.raises(BadRequestError, match="Invalid token"):
        service.reset_password(token="invalid", new_password="new-password123")


def test_reset_password_updates_user_password() -> None:
    settings = FakeSettings()
    fake_session = FakeSession()
    user = make_user(email="user@example.com", password="old-password123")
    service = AuthService(
        cast(Session, fake_session),
        settings=settings,
        send_email=lambda **_: None,
        users=cast(UserRepository, FakeUsers(user)),
    )
    token = generate_password_reset_token(
        email=user.email,
        secret_key=settings.SECRET_KEY.get_secret_value(),
        expire_hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
    )

    result = service.reset_password(token=token, new_password="new-password123")

    assert result.message == "Password updated successfully"
    assert fake_session.committed == 1


def test_build_password_recovery_html_content_rejects_missing_user() -> None:
    service = AuthService(
        make_session(),
        settings=FakeSettings(),
        send_email=lambda **_: None,
        users=cast(UserRepository, FakeUsers(None)),
    )

    with pytest.raises(NotFoundError, match="username does not exist"):
        service.build_password_recovery_html_content(email="missing@example.com")
