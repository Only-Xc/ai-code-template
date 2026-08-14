FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app/
ENV PATH="/app/.venv/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=apps/api/pyproject.toml,target=apps/api/pyproject.toml \
    --mount=type=bind,source=modules/auth/pyproject.toml,target=modules/auth/pyproject.toml \
    --mount=type=bind,source=modules/items/pyproject.toml,target=modules/items/pyproject.toml \
    --mount=type=bind,source=packages/core/pyproject.toml,target=packages/core/pyproject.toml \
    uv sync --frozen --no-install-workspace --package app

COPY ./pyproject.toml ./uv.lock /app/
COPY ./apps /app/apps
COPY ./modules /app/modules
COPY ./packages /app/packages

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --package app

WORKDIR /app/apps/api/

CMD ["fastapi", "run", "app/module_apps/auth.py", "--workers", "4"]
