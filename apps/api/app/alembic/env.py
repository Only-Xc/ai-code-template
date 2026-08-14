from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlmodel import SQLModel

import app.model_registry  # noqa: F401  # 注册全部 SQLModel 表，供 autogenerate 对比

from fast_core.settings import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 连接串取自应用 Settings（按 ENVIRONMENT 读取 .env.<environment>），alembic.ini 不存凭据。
DATABASE_URL = str(settings.SQLALCHEMY_DATABASE_URI)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
