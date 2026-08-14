from fast_auth.models import User
from fast_auth.repositories.user_repository import UserRepository
from fast_auth.schemas import UserCreate, UserUpdate
from fast_auth.services.auth_service import AuthService
from fast_core.settings import settings
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from tests.utils.utils import random_email, random_lower_string


def user_authentication_headers(
    *, client: TestClient, email: str, password: str
) -> dict[str, str]:
    data = {"username": email, "password": password}

    r = client.post(f"{settings.API_PREFIX}/v1/login/access-token", data=data)
    response = r.json()
    auth_token = response["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    return headers


def create_random_user(db: Session) -> User:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = AuthService(
        db,
        settings=settings,
        send_email=lambda **_: None,
    ).create_user(user_create=user_in)
    return user


def ensure_test_superuser(session: Session) -> User:
    auth_service = AuthService(
        session,
        settings=settings,
        send_email=lambda **_: None,
    )
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if user:
        return auth_service.update_user(
            db_user=user,
            user_in=UserUpdate(
                password=settings.FIRST_SUPERUSER_PASSWORD.get_secret_value(),
                is_active=True,
                is_superuser=True,
            ),
        )
    return auth_service.create_user(
        user_create=UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD.get_secret_value(),
            is_superuser=True,
        )
    )


def authentication_token_from_email(
    *, client: TestClient, email: str, db: Session
) -> dict[str, str]:
    """
    Return a valid token for the user with given email.

    If the user doesn't exist it is created first.
    """
    password = random_lower_string()
    users = UserRepository(db)
    auth_service = AuthService(
        db,
        settings=settings,
        send_email=lambda **_: None,
        users=users,
    )
    user = users.get_by_email(email=email)
    if not user:
        user_in_create = UserCreate(email=email, password=password)
        user = auth_service.create_user(user_create=user_in_create)
    else:
        user_in_update = UserUpdate(password=password)
        if not user.id:
            raise Exception("User id not set")
        user = auth_service.update_user(db_user=user, user_in=user_in_update)

    return user_authentication_headers(client=client, email=email, password=password)
