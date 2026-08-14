import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import emails  # type: ignore[import-untyped]
from jinja2 import Template
from pydantic import SecretStr

logger = logging.getLogger(__name__)


class EmailSettings(Protocol):
    PROJECT_NAME: str
    API_PREFIX: str
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int
    EMAILS_FROM_NAME: str | None
    EMAILS_FROM_EMAIL: str | None
    SMTP_HOST: str | None
    SMTP_PORT: int
    SMTP_TLS: bool
    SMTP_SSL: bool
    SMTP_USER: str | None
    SMTP_PASSWORD: SecretStr | None


@dataclass
class EmailData:
    html_content: str
    subject: str


def render_email_template(*, template_name: str, context: dict[str, Any]) -> str:
    template_str = (
        Path(__file__).parent / "email_templates" / "build" / template_name
    ).read_text()
    return Template(template_str).render(context)


def send_email(
    *,
    settings: EmailSettings,
    email_to: str,
    subject: str = "",
    html_content: str = "",
) -> None:
    message = emails.Message(
        subject=subject,
        html=html_content,
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    smtp_options = {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
    elif settings.SMTP_SSL:
        smtp_options["ssl"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD.get_secret_value()
    response = message.send(to=email_to, smtp=smtp_options)
    logger.info("send email result: %s", response)


def generate_reset_password_email(
    *, settings: EmailSettings, email_to: str, email: str, token: str
) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Password recovery for user {email}"
    html_content = render_email_template(
        template_name="reset_password.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": email,
            "email": email_to,
            "valid_hours": settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
            "reset_path": f"{settings.API_PREFIX}/v1/reset-password/",
            "token": token,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_new_account_email(
    *, settings: EmailSettings, email_to: str, username: str, password: str
) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - New account for user {username}"
    html_content = render_email_template(
        template_name="new_account.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": username,
            "password": password,
            "email": email_to,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_test_email(*, settings: EmailSettings, email_to: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    html_content = render_email_template(
        template_name="test_email.html",
        context={"project_name": settings.PROJECT_NAME, "email": email_to},
    )
    return EmailData(html_content=html_content, subject=subject)
