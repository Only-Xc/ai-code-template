import logging

from fast_auth.models import User
from fast_auth.schemas import UserCreate, UserUpdate
from fast_auth.services.auth_service import AuthService
from fast_core.database import create_engine_from_settings
from fast_core.settings import settings
from sqlmodel import Session, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def noop_send_email(
    *, email_to: str, subject: str = "", html_content: str = ""
) -> None:
    pass


def create_or_update_superuser(session: Session) -> User:
    auth_service = AuthService(
        session,
        settings=settings,
        send_email=noop_send_email,
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


def main() -> None:
    logger.info("Creating or updating explicit superuser")
    engine = create_engine_from_settings(settings)
    try:
        with Session(engine) as session:
            create_or_update_superuser(session)
    finally:
        engine.dispose()
    logger.info("Superuser is ready")


if __name__ == "__main__":
    main()
