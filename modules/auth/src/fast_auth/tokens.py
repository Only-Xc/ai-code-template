from datetime import UTC, datetime, timedelta

import jwt
from fast_core.security import ALGORITHM
from jwt.exceptions import InvalidTokenError


def generate_password_reset_token(
    *, email: str, secret_key: str, expire_hours: int
) -> str:
    delta = timedelta(hours=expire_hours)
    now = datetime.now(UTC)
    expires = now + delta
    exp = expires.timestamp()
    return jwt.encode(
        {"exp": exp, "nbf": now, "sub": email},
        secret_key,
        algorithm=ALGORITHM,
    )


def verify_password_reset_token(*, token: str, secret_key: str) -> str | None:
    try:
        decoded_token = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        return str(decoded_token["sub"])
    except InvalidTokenError:
        return None
