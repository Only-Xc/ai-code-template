from typing import Annotated

from fast_core.cache.client import CacheClientDep
from fast_core.deps import SessionDep
from fast_core.errors import ForbiddenError
from fast_core.settings import settings
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from fast_auth.email import send_email
from fast_auth.models import User
from fast_auth.services.auth_service import AuthService
from fast_auth.services.user_service import UserService

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/v1/login/access-token"
)


def send_email_adapter(
    *, email_to: str, subject: str = "", html_content: str = ""
) -> None:
    send_email(
        settings=settings,
        email_to=email_to,
        subject=subject,
        html_content=html_content,
    )


def get_auth_service(session: SessionDep, cache: CacheClientDep) -> AuthService:
    return AuthService(
        session,
        settings=settings,
        send_email=send_email_adapter,
        cache=cache,
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_user_service(session: SessionDep) -> UserService:
    return UserService(
        session,
        settings=settings,
        send_email=send_email_adapter,
    )


UserServiceDep = Annotated[UserService, Depends(get_user_service)]


def get_current_user(
    auth_service: AuthServiceDep,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    return auth_service.get_user_from_token(token)


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUserDep) -> User:
    if not current_user.is_superuser:
        raise ForbiddenError("The user doesn't have enough privileges")
    return current_user


CurrentActiveSuperuserDep = Annotated[User, Depends(get_current_active_superuser)]
