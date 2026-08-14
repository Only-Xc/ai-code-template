import uuid
from typing import Any

from sqlmodel import Session, col, func, select

from fast_auth.models import User
from fast_auth.schemas import UserCreate, UserUpdate


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, user_id: uuid.UUID | str | None) -> User | None:
        if user_id is None:
            return None
        return self.session.get(User, user_id)

    def get_by_email(self, *, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.session.exec(statement).first()

    def list(self, *, skip: int = 0, limit: int = 100) -> tuple[list[User], int]:
        count_statement = select(func.count()).select_from(User)
        count = self.session.exec(count_statement).one()
        statement = (
            select(User).order_by(col(User.created_at).desc()).offset(skip).limit(limit)
        )
        users = list(self.session.exec(statement).all())
        return users, count

    def add(self, user: User) -> User:
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def update(self, *, db_user: User, user_in: UserUpdate) -> Any:
        user_data = user_in.model_dump(exclude_unset=True)
        db_user.sqlmodel_update(user_data)
        self.session.add(db_user)
        self.session.flush()
        self.session.refresh(db_user)
        return db_user

    def delete(self, user: User) -> None:
        self.session.delete(user)
        self.session.flush()

    def create(self, *, user_create: UserCreate, hashed_password: str) -> User:
        db_obj = User.model_validate(
            user_create, update={"hashed_password": hashed_password}
        )
        return self.add(db_obj)

    def update_with_extra(
        self, *, db_user: User, user_in: UserUpdate, extra_data: dict[str, Any]
    ) -> Any:
        user_data = user_in.model_dump(exclude_unset=True)
        db_user.sqlmodel_update(user_data, update=extra_data)
        self.session.add(db_user)
        self.session.flush()
        self.session.refresh(db_user)
        return db_user
