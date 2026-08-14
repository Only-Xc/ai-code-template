import hashlib
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import jwt
from fast_core.cache.client import CacheClient
from fast_core.errors import BadRequestError, NotFoundError, UnauthorizedError
from fast_core.security import (
    ALGORITHM,
    create_access_token,
    get_password_hash,
    verify_password,
)
from jwt.exceptions import InvalidTokenError
from pydantic import SecretStr, ValidationError
from sqlmodel import Session

from fast_auth.email import generate_reset_password_email
from fast_auth.models import User
from fast_auth.repositories.user_repository import UserRepository
from fast_auth.schemas import Message, Token, TokenPayload, UserCreate, UserUpdate
from fast_auth.services.user_service import build_user_update_extra
from fast_auth.tokens import generate_password_reset_token, verify_password_reset_token

# Argon2 hash of a random password, used to keep failed login timing stable.
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"
REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30


@dataclass(frozen=True)
class PasswordRecoveryEmail:
    html_content: str
    subject: str


class AuthService:
    def __init__(
        self,
        session: Session,
        *,
        settings: Any,
        send_email: Callable[..., None],
        cache: CacheClient | None = None,
        users: UserRepository | None = None,
    ) -> None:
        self.session = session
        self.settings = settings
        self.send_email = send_email
        self.cache = cache
        self.users = users or UserRepository(session)

    def _secret_value(self) -> str:
        secret_key = self.settings.SECRET_KEY
        if isinstance(secret_key, SecretStr):
            return secret_key.get_secret_value()
        return str(secret_key)

    def authenticate(self, *, email: str, password: str) -> User | None:
        """Transaction: self-committing when password hash is upgraded."""
        db_user = self.users.get_by_email(email=email)
        if not db_user:
            verify_password(password, DUMMY_HASH)
            return None

        verified, updated_password_hash = verify_password(
            password, db_user.hashed_password
        )
        if not verified:
            return None

        if updated_password_hash:
            db_user.hashed_password = updated_password_hash
            self.session.add(db_user)
            self.session.commit()
            self.session.refresh(db_user)

        return db_user

    async def create_token_for_login(self, *, email: str, password: str) -> Token:
        user = self.authenticate(email=email, password=password)
        if not user:
            raise BadRequestError("Incorrect email or password")
        if not user.is_active:
            raise BadRequestError("Inactive user")
        return await self._issue_token_pair(user)

    def create_access_token_for_login(self, *, email: str, password: str) -> Token:
        user = self.authenticate(email=email, password=password)
        if not user:
            raise BadRequestError("Incorrect email or password")
        if not user.is_active:
            raise BadRequestError("Inactive user")
        return Token(
            access_token=create_access_token(
                subject=user.id,
                expires_delta=self.settings.access_token_expires_delta,
                secret_key=self._secret_value(),
            ),
            refresh_token="",
        )

    async def refresh_access_token(self, *, refresh_token: str) -> Token:
        cache = self._require_cache()
        user_id = await cache.get_text(self._refresh_token_key(refresh_token))
        if user_id is None:
            raise UnauthorizedError("Invalid refresh token")
        user = self.users.get(user_id)
        if not user:
            await cache.delete(self._refresh_token_key(refresh_token))
            raise UnauthorizedError("Invalid refresh token")
        if not user.is_active:
            raise BadRequestError("Inactive user")
        await cache.delete(self._refresh_token_key(refresh_token))
        return await self._issue_token_pair(user)

    async def logout(self, *, refresh_token: str) -> Message:
        cache = self._require_cache()
        await cache.delete(self._refresh_token_key(refresh_token))
        return Message(message="Logged out successfully")

    def create_user(self, *, user_create: UserCreate) -> User:
        """Transaction: self-committing."""
        user = self.users.create(
            user_create=user_create,
            hashed_password=get_password_hash(user_create.password),
        )
        self.session.commit()
        self.session.refresh(user)
        return user

    def update_user(self, *, db_user: User, user_in: UserUpdate) -> Any:
        """Transaction: self-committing."""
        extra_data = build_user_update_extra(user_in)
        user = self.users.update_with_extra(
            db_user=db_user, user_in=user_in, extra_data=extra_data
        )
        self.session.commit()
        self.session.refresh(user)
        return user

    def get_user_by_email(self, *, email: str) -> User | None:
        return self.users.get_by_email(email=email)

    def get_user_from_token(self, token: str) -> User:
        try:
            payload = jwt.decode(token, self._secret_value(), algorithms=[ALGORITHM])
            token_data = TokenPayload(**payload)
        except (InvalidTokenError, ValidationError):
            raise UnauthorizedError("Could not validate credentials")
        user = self.users.get(token_data.sub)
        if not user:
            raise NotFoundError("User not found")
        if not user.is_active:
            raise BadRequestError("Inactive user")
        return user

    async def _issue_token_pair(self, user: User) -> Token:
        refresh_token = uuid.uuid4().hex
        await self._store_refresh_token(refresh_token=refresh_token, user_id=user.id)
        return Token(
            access_token=create_access_token(
                subject=user.id,
                expires_delta=self.settings.access_token_expires_delta,
                secret_key=self._secret_value(),
            ),
            refresh_token=refresh_token,
        )

    async def _store_refresh_token(
        self,
        *,
        refresh_token: str,
        user_id: uuid.UUID,
    ) -> None:
        cache = self._require_cache()
        await cache.set_text(
            self._refresh_token_key(refresh_token),
            str(user_id),
            ttl_seconds=REFRESH_TOKEN_TTL_SECONDS,
        )

    def _refresh_token_key(self, refresh_token: str) -> str:
        token_digest = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        return f"auth:refresh-token:{token_digest}"

    def _require_cache(self) -> CacheClient:
        if self.cache is None:
            raise RuntimeError("Refresh token support requires a CacheClient")
        return self.cache

    def send_password_recovery_email(self, *, email: str) -> Message:
        user = self.get_user_by_email(email=email)
        if user:
            email_data = self.build_password_recovery_email(email=email, user=user)
            self.send_email(
                email_to=user.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
        return Message(
            message="If that email is registered, we sent a password recovery link"
        )

    def reset_password(self, *, token: str, new_password: str) -> Message:
        email = verify_password_reset_token(
            token=token,
            secret_key=self._secret_value(),
        )
        if not email:
            raise BadRequestError("Invalid token")
        user = self.get_user_by_email(email=email)
        if not user:
            raise BadRequestError("Invalid token")
        if not user.is_active:
            raise BadRequestError("Inactive user")
        self.update_user(db_user=user, user_in=UserUpdate(password=new_password))
        return Message(message="Password updated successfully")

    def build_password_recovery_html_content(
        self, *, email: str
    ) -> PasswordRecoveryEmail:
        user = self.get_user_by_email(email=email)
        if not user:
            raise NotFoundError(
                "The user with this username does not exist in the system."
            )
        return self.build_password_recovery_email(email=email, user=user)

    def build_password_recovery_email(
        self, *, email: str, user: User
    ) -> PasswordRecoveryEmail:
        password_reset_token = generate_password_reset_token(
            email=email,
            secret_key=self._secret_value(),
            expire_hours=self.settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
        )
        email_data = generate_reset_password_email(
            settings=self.settings,
            email_to=user.email,
            email=email,
            token=password_reset_token,
        )
        return PasswordRecoveryEmail(
            html_content=email_data.html_content,
            subject=email_data.subject,
        )
