from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from fast_auth.models import User
from fast_core.security import get_password_hash
from pydantic import SecretStr


@dataclass
class FakeSettings:
    SECRET_KEY: SecretStr = SecretStr("test-secret")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48
    PROJECT_NAME: str = "Test Project"
    API_PREFIX: str = "/api"
    EMAILS_FROM_NAME: str | None = "Test Project"
    EMAILS_FROM_EMAIL: str | None = "noreply@example.com"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_USER: str | None = None
    SMTP_PASSWORD: SecretStr | None = None

    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    @property
    def access_token_expires_delta(self) -> timedelta:
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)


@dataclass
class FakeSession:
    committed: int = 0
    refreshed: list[Any] = field(default_factory=list)
    added: list[Any] = field(default_factory=list)
    rolled_back: int = 0

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    def commit(self) -> None:
        self.committed += 1

    def flush(self) -> None:
        pass

    def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    def rollback(self) -> None:
        self.rolled_back += 1

    def get(self, model_cls: type[Any], pk: Any) -> Any | None:
        for obj in self.added:
            if isinstance(obj, model_cls) and getattr(obj, "id", None) == pk:
                return obj
        return None


def make_user(
    *,
    email: str = "user@example.com",
    password: str = "password123",
    is_active: bool = True,
    is_superuser: bool = False,
) -> User:
    return User(
        email=email,
        hashed_password=get_password_hash(password),
        is_active=is_active,
        is_superuser=is_superuser,
    )
