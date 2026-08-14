from fast_core.openapi import merge_common_error_responses
from fast_core.settings import settings
from fastapi import APIRouter, Depends
from pydantic.networks import EmailStr

from fast_auth.deps import get_current_active_superuser, send_email_adapter
from fast_auth.email import generate_test_email
from fast_auth.schemas import Message

router = APIRouter(
    prefix="/utils",
    tags=["utils"],
    responses=merge_common_error_responses(),
)


@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
def test_email(email_to: EmailStr) -> Message:
    """
    Test emails.
    """
    email_data = generate_test_email(settings=settings, email_to=email_to)
    send_email_adapter(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")
