import uuid
from collections.abc import Callable
from typing import Any

from fast_core.errors import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from fast_core.pagination import PaginationParams
from fast_core.security import get_password_hash, verify_password
from sqlmodel import Session

from fast_auth.email import generate_new_account_email
from fast_auth.models import User
from fast_auth.repositories.user_repository import UserRepository
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


def build_user_update_extra(user_in: UserUpdate) -> dict[str, str]:
    user_data = user_in.model_dump(exclude_unset=True)
    if "password" not in user_data:
        return {}
    return {"hashed_password": get_password_hash(user_data["password"])}


class UserService:
    def __init__(
        self,
        session: Session,
        *,
        settings: Any,
        send_email: Callable[..., None],
        delete_user_related_data: Callable[..., None] | None = None,
        users: UserRepository | None = None,
    ) -> None:
        self.session = session
        self.settings = settings
        self.send_email = send_email
        self.delete_user_related_data = delete_user_related_data
        self.users = users or UserRepository(session)

    def list_users(self, *, skip: int = 0, limit: int = 100) -> UsersPublic:
        pagination = PaginationParams.from_skip_limit(skip=skip, limit=limit)
        users, count = self.users.list(skip=pagination.offset, limit=pagination.limit)
        users_public = [UserPublic.model_validate(user) for user in users]
        return UsersPublic(data=users_public, count=count)

    def create_user(self, *, user_in: UserCreate) -> User:
        """Transaction: self-committing."""
        existing_user = self.get_user_by_email(email=user_in.email)
        if existing_user:
            raise BadRequestError(
                "The user with this email already exists in the system."
            )
        user = self.users.create(
            user_create=user_in,
            hashed_password=get_password_hash(user_in.password),
        )
        self.session.commit()
        self.session.refresh(user)
        if self.settings.emails_enabled and user_in.email:
            email_data = generate_new_account_email(
                settings=self.settings,
                email_to=user_in.email,
                username=user_in.email,
                password=user_in.password,
            )
            self.send_email(
                email_to=user_in.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
        return user

    def register_user(self, *, user_in: UserRegister) -> User:
        """Transaction: self-committing."""
        existing_user = self.get_user_by_email(email=user_in.email)
        if existing_user:
            raise BadRequestError(
                "The user with this email already exists in the system"
            )
        user_create = UserCreate.model_validate(user_in)
        user = self.users.create(
            user_create=user_create,
            hashed_password=get_password_hash(user_create.password),
        )
        self.session.commit()
        self.session.refresh(user)
        return user

    def update_me(self, *, current_user: User, user_in: UserUpdateMe) -> User:
        """Transaction: self-committing."""
        if user_in.email:
            existing_user = self.get_user_by_email(email=user_in.email)
            if existing_user and existing_user.id != current_user.id:
                raise ConflictError("User with this email already exists")
        user_data = user_in.model_dump(exclude_unset=True)
        current_user.sqlmodel_update(user_data)
        self.session.add(current_user)
        self.session.commit()
        self.session.refresh(current_user)
        return current_user

    def update_my_password(
        self, *, current_user: User, body: UpdatePassword
    ) -> Message:
        """Transaction: self-committing."""
        verified, _ = verify_password(
            body.current_password, current_user.hashed_password
        )
        if not verified:
            raise BadRequestError("Incorrect password")
        if body.current_password == body.new_password:
            raise BadRequestError("New password cannot be the same as the current one")
        current_user.hashed_password = get_password_hash(body.new_password)
        self.session.add(current_user)
        self.session.commit()
        return Message(message="Password updated successfully")

    def get_user_by_id(self, *, user_id: uuid.UUID | str | None) -> User | None:
        return self.users.get(user_id)

    def get_user_by_email(self, *, email: str) -> User | None:
        return self.users.get_by_email(email=email)

    def get_visible_user(self, *, user_id: uuid.UUID, current_user: User) -> User:
        user = self.get_user_by_id(user_id=user_id)
        if user is None:
            raise NotFoundError("User not found")
        if user == current_user:
            return user
        if not current_user.is_superuser:
            raise ForbiddenError("The user doesn't have enough privileges")
        return user

    def update_user(self, *, db_user: User, user_in: UserUpdate) -> User:
        """Transaction: self-committing."""
        if user_in.email:
            existing_user = self.get_user_by_email(email=user_in.email)
            if existing_user and existing_user.id != db_user.id:
                raise ConflictError("User with this email already exists")
        extra_data = build_user_update_extra(user_in)
        user = self.users.update_with_extra(
            db_user=db_user, user_in=user_in, extra_data=extra_data
        )
        self.session.commit()
        self.session.refresh(user)
        return user

    def update_user_by_id(self, *, user_id: uuid.UUID, user_in: UserUpdate) -> User:
        db_user = self.get_user_by_id(user_id=user_id)
        if not db_user:
            raise NotFoundError("The user with this id does not exist in the system")
        return self.update_user(db_user=db_user, user_in=user_in)

    def delete_me(self, *, current_user: User) -> Message:
        """Transaction: self-committing."""
        if current_user.is_superuser:
            raise ForbiddenError("Super users are not allowed to delete themselves")
        if self.delete_user_related_data:
            self.delete_user_related_data(session=self.session, user_id=current_user.id)
        self.users.delete(current_user)
        self.session.commit()
        return Message(message="User deleted successfully")

    def delete_user(self, *, user: User) -> Message:
        """Transaction: self-committing."""
        if self.delete_user_related_data:
            self.delete_user_related_data(session=self.session, user_id=user.id)
        self.users.delete(user)
        self.session.commit()
        return Message(message="User deleted successfully")

    def delete_user_by_id(self, *, user_id: uuid.UUID, current_user: User) -> Message:
        user = self.get_user_by_id(user_id=user_id)
        if not user:
            raise NotFoundError("User not found")
        if user == current_user:
            raise ForbiddenError("Super users are not allowed to delete themselves")
        return self.delete_user(user=user)
