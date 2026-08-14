from typing import Annotated, Any

from fast_core.openapi import merge_common_error_responses
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

from fast_auth.deps import AuthServiceDep, CurrentActiveSuperuserDep, CurrentUserDep
from fast_auth.schemas import Message, NewPassword, RefreshToken, Token, UserPublic

router = APIRouter(tags=["login"], responses=merge_common_error_responses())


@router.post("/login/access-token")
async def login_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    auth_service: AuthServiceDep,
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    return await auth_service.create_token_for_login(
        email=form_data.username,
        password=form_data.password,
    )


@router.post("/login/refresh-token")
async def refresh_access_token(
    body: RefreshToken,
    auth_service: AuthServiceDep,
) -> Token:
    """
    Refresh access token and rotate refresh token.
    """
    return await auth_service.refresh_access_token(refresh_token=body.refresh_token)


@router.post("/logout", response_model=Message)
async def logout(body: RefreshToken, auth_service: AuthServiceDep) -> Message:
    """
    Revoke refresh token.
    """
    return await auth_service.logout(refresh_token=body.refresh_token)


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUserDep) -> Any:
    """
    Test access token
    """
    return current_user


@router.post("/password-recovery/{email}")
def recover_password(email: str, auth_service: AuthServiceDep) -> Message:
    """
    Password Recovery
    """
    return auth_service.send_password_recovery_email(email=email)


@router.post("/reset-password/")
def reset_password(body: NewPassword, auth_service: AuthServiceDep) -> Message:
    """
    Reset password
    """
    return auth_service.reset_password(
        token=body.token,
        new_password=body.new_password,
    )


@router.post(
    "/password-recovery-html-content/{email}",
    response_class=HTMLResponse,
)
def recover_password_html_content(
    email: str,
    _: CurrentActiveSuperuserDep,
    auth_service: AuthServiceDep,
) -> HTMLResponse:
    """
    HTML Content for Password Recovery
    """
    email_data = auth_service.build_password_recovery_html_content(email=email)
    return HTMLResponse(
        content=email_data.html_content,
        headers={"subject:": email_data.subject},
    )
