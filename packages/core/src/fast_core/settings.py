import warnings
from datetime import timedelta
from os import environ
from pathlib import Path
from typing import Annotated, Any, Literal, TypeAlias

from pydantic import (
    AnyUrl,
    BeforeValidator,
    EmailStr,
    HttpUrl,
    PostgresDsn,
    RedisDsn,
    SecretStr,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment: TypeAlias = Literal["development", "test", "production"]
LEGACY_ENVIRONMENT_MAP = {
    "local": "development",
    "staging": "production",
}
REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_ENVIRONMENT: Environment = "development"


def parse_cors(value: Any) -> list[str] | str:
    # 环境变量里常用逗号分隔字符串，pydantic 也支持 JSON list；两种格式都接受。
    if isinstance(value, str) and not value.startswith("["):
        return [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(value, list | str):
        return value
    raise ValueError(value)


def get_env_file() -> Path:
    environment = environ.get("ENVIRONMENT", DEFAULT_ENVIRONMENT)
    normalized = LEGACY_ENVIRONMENT_MAP.get(environment, environment)
    # 旧环境名保留兼容提示，避免 CI/CD 静默加载出乎预期的 .env 文件。
    if normalized != environment:
        warnings.warn(
            f"ENVIRONMENT='{environment}' is deprecated and treated as '{normalized}'.",
            DeprecationWarning,
            stacklevel=2,
        )
    if normalized not in ("development", "test", "production"):
        warnings.warn(
            f"ENVIRONMENT='{environment}' is unknown and treated as '{DEFAULT_ENVIRONMENT}'.",
            RuntimeWarning,
            stacklevel=2,
        )
        normalized = DEFAULT_ENVIRONMENT
    return REPO_ROOT / f".env.{normalized}"


class Settings(BaseSettings):
    # env_file 在类定义时解析，应用启动失败会尽早暴露缺失的必填配置。
    model_config = SettingsConfigDict(
        env_file=(get_env_file(),),
        env_ignore_empty=True,
        extra="ignore",
    )

    API_PREFIX: str = "/api"
    SECRET_KEY: SecretStr
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ENVIRONMENT: Environment = DEFAULT_ENVIRONMENT
    LOGIN_RATE_LIMIT_REQUESTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 60

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None

    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: SecretStr = SecretStr("")
    POSTGRES_DB: str = ""
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    REDIS_URL: RedisDsn = RedisDsn("redis://localhost:6379/0")

    OBJECT_STORAGE_ENDPOINT: str = "http://localhost:9000"
    OBJECT_STORAGE_ACCESS_KEY: str = "minioadmin"
    OBJECT_STORAGE_SECRET_KEY: SecretStr = SecretStr("minioadmin123")
    OBJECT_STORAGE_BUCKET: str = "fast-platform"
    OBJECT_STORAGE_REGION: str = "us-east-1"
    OBJECT_STORAGE_SECURE: bool = False
    OBJECT_STORAGE_PUBLIC_BASE_URL: str | None = None
    OBJECT_STORAGE_AUTO_CREATE_BUCKET: bool = False
    OBJECT_STORAGE_READINESS_CHECK_ENABLED: bool = False

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: SecretStr | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: str | None = None
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48
    EMAIL_TEST_USER: EmailStr = "test@example.com"

    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: SecretStr

    @model_validator(mode="after")
    def validate_production_cors(self) -> "Settings":
        # production 禁止通配 CORS，避免浏览器端凭证被任意来源复用。
        if self.ENVIRONMENT != "production":
            return self
        if "*" in self.all_cors_origins:
            raise ValueError("Wildcard CORS origin is not allowed in production")
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        # SecretStr 只在真正拼接连接串时解包，降低调试日志泄露概率。
        return PostgresDsn.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD.get_secret_value(),
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def access_token_expires_delta(self) -> timedelta:
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)


settings = Settings()  # type: ignore[call-arg]


def get_settings() -> Settings:
    # FastAPI dependency_overrides 以这个函数为 key，测试可替换配置入口。
    return settings
