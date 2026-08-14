from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

ALGORITHM = "HS256"

password_hash = PasswordHash(
    (
        # Argon2 是当前写入算法，Bcrypt 保留用于验证并迁移历史密码哈希。
        Argon2Hasher(),
        BcryptHasher(),
    )
)


def create_access_token(
    *,
    subject: str | Any,
    expires_delta: timedelta,
    secret_key: str,
    algorithm: str = ALGORITHM,
) -> str:
    expire = datetime.now(UTC) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    # pwdlib 在旧算法验证成功时返回升级后的 hash，调用方可顺手持久化。
    return password_hash.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)
