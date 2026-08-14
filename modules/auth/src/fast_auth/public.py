from sqlmodel import Session

from fast_auth.deps import CurrentActiveSuperuserDep, CurrentUserDep
from fast_auth.repositories.user_repository import UserRepository
from fast_auth.schemas import UserPublic

__all__ = ["AuthPublicApi", "CurrentActiveSuperuserDep", "CurrentUserDep"]


class AuthPublicApi:
    def __init__(self, session: Session) -> None:
        self.users = UserRepository(session)

    def get_user_by_email(self, *, email: str) -> UserPublic | None:
        user = self.users.get_by_email(email=email)
        if user is None:
            return None
        return UserPublic.model_validate(user)
