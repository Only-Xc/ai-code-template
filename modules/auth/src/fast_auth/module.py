from collections.abc import Callable
from dataclasses import dataclass

from fastapi import APIRouter

from fast_auth.deps import get_current_active_superuser, get_current_user
from fast_auth.models import User
from fast_auth.routers import login, users, utils


@dataclass(frozen=True)
class AuthModule:
    router: APIRouter
    get_current_user: Callable[..., User]
    get_current_active_superuser: Callable[..., User]


def create_auth_module() -> AuthModule:
    router = APIRouter(prefix="/v1")
    router.include_router(login.router)
    router.include_router(users.router)
    router.include_router(utils.router)

    return AuthModule(
        router=router,
        get_current_user=get_current_user,
        get_current_active_superuser=get_current_active_superuser,
    )


auth_module = create_auth_module()
