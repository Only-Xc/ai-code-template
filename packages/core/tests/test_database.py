import pytest
from fast_core.database import create_engine_from_settings, make_test_session
from fast_core.settings import REPO_ROOT, Settings, get_env_file
from pydantic import SecretStr
from sqlmodel import create_engine


def make_settings(
    *,
    db_pool_size: int = 5,
    db_max_overflow: int = 10,
    db_pool_timeout: int = 30,
) -> Settings:
    return Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        PROJECT_NAME="Test",
        POSTGRES_SERVER="localhost",
        POSTGRES_USER="postgres",
        POSTGRES_PASSWORD=SecretStr("changethis"),
        POSTGRES_DB="app",
        FIRST_SUPERUSER="admin@example.com",
        FIRST_SUPERUSER_PASSWORD=SecretStr("changethis"),
        SECRET_KEY=SecretStr("changethis"),
        OBJECT_STORAGE_ACCESS_KEY="minio-access-key",
        OBJECT_STORAGE_SECRET_KEY=SecretStr("minio-secret-key"),
        DB_POOL_SIZE=db_pool_size,
        DB_MAX_OVERFLOW=db_max_overflow,
        DB_POOL_TIMEOUT=db_pool_timeout,
    )


def test_database_pool_settings_defaults() -> None:
    settings = make_settings()

    assert settings.DB_POOL_SIZE == 5
    assert settings.DB_MAX_OVERFLOW == 10
    assert settings.DB_POOL_TIMEOUT == 30


def test_database_pool_settings_can_be_overridden() -> None:
    settings = make_settings(
        db_pool_size=7,
        db_max_overflow=3,
        db_pool_timeout=9,
    )

    assert settings.DB_POOL_SIZE == 7
    assert settings.DB_MAX_OVERFLOW == 3
    assert settings.DB_POOL_TIMEOUT == 9


def test_rate_limit_settings_defaults() -> None:
    settings = make_settings()

    assert settings.LOGIN_RATE_LIMIT_REQUESTS == 5
    assert settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS == 60


def test_object_storage_settings_defaults() -> None:
    settings = make_settings()

    assert settings.OBJECT_STORAGE_ENDPOINT == "http://localhost:9000"
    assert settings.OBJECT_STORAGE_ACCESS_KEY == "minio-access-key"
    assert settings.OBJECT_STORAGE_SECRET_KEY.get_secret_value() == "minio-secret-key"
    assert settings.OBJECT_STORAGE_BUCKET == "fast-platform"
    assert settings.OBJECT_STORAGE_REGION == "us-east-1"


def test_development_environment_loads() -> None:
    settings = make_settings()

    assert settings.ENVIRONMENT == "development"


def test_test_environment_loads() -> None:
    settings = Settings(
        PROJECT_NAME="Test",
        ENVIRONMENT="test",
        POSTGRES_SERVER="localhost",
        POSTGRES_USER="postgres",
        POSTGRES_PASSWORD=SecretStr("changethis"),
        POSTGRES_DB="app",
        FIRST_SUPERUSER="admin@example.com",
        FIRST_SUPERUSER_PASSWORD=SecretStr("changethis"),
        SECRET_KEY=SecretStr("changethis"),
        OBJECT_STORAGE_ACCESS_KEY="minio-access-key",
        OBJECT_STORAGE_SECRET_KEY=SecretStr("minio-secret-key"),
    )

    assert settings.ENVIRONMENT == "test"


def test_env_file_defaults_to_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    assert get_env_file() == REPO_ROOT / ".env.development"


def test_env_file_uses_selected_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")

    assert get_env_file() == REPO_ROOT / ".env.production"


def test_env_file_normalizes_legacy_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "staging")

    with pytest.warns(DeprecationWarning):
        assert get_env_file() == REPO_ROOT / ".env.production"


def test_session_factory_yields_session() -> None:
    engine = create_engine("sqlite://")

    with make_test_session(engine) as session:
        assert session.bind is engine


def test_create_engine_from_settings_uses_database_url() -> None:
    settings = make_settings()
    engine = create_engine_from_settings(settings)

    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.host == settings.POSTGRES_SERVER
    assert engine.url.database == settings.POSTGRES_DB
    engine.dispose()
