# 开发指南

## 安装依赖

项目使用 `uv` 管理 monorepo workspace。

```bash
uv sync
```

Python 版本固定为 3.11。

## Docker Compose

Compose 文件位于 `deploy/compose/`。开发环境的 Docker 只启动依赖服务，后端在本机运行。

本地首次启动按顺序执行：

```bash
python scripts/dev.py compose-up
python scripts/dev.py migrate
python scripts/dev.py create-superuser
python scripts/dev.py api
```

后续开发通常只需要启动 API：

```bash
python scripts/dev.py api
```

如果 Docker 依赖服务没有运行，先执行 `python scripts/dev.py compose-up`。新增 migration 后重新执行 `python scripts/dev.py migrate`。

底层等价命令：

```bash
docker compose \
  --project-directory . \
  --env-file .env.development \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.override.yml \
  up -d --remove-orphans db redis minio mailcatcher
```

常用命令：

```bash
python scripts/dev.py compose-logs
python scripts/dev.py compose-down
```

底层等价命令：

```bash
docker compose \
  --project-directory . \
  --env-file .env.development \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.override.yml \
  logs db redis minio mailcatcher

docker compose \
  --project-directory . \
  --env-file .env.development \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.override.yml \
  down --remove-orphans
```

本地服务地址：

- API：<http://localhost:8000>
- Swagger UI：<http://localhost:8000/docs>
- ReDoc：<http://localhost:8000/redoc>
- MinIO API：<http://localhost:9000>
- MinIO Console：<http://localhost:9001>
- Mailcatcher：<http://localhost:1080>

## 本机启动 API

```bash
python scripts/dev.py api
```

## 代码检查

项目只使用 Ruff 和 Pyright。

```bash
uv run ruff format apps/api modules packages
uv run ruff check apps/api modules packages
uv run pyright apps/api modules packages
```

## 测试

运行 API 测试：

```bash
cd apps/api
uv run pytest
```

运行仓库质量门禁：

```bash
python scripts/verify.py --fast
```

## Pre-commit

项目使用 `prek` 运行提交前检查。

安装 hook：

```bash
uv run prek install -f
```

手动运行：

```bash
uv run prek run --all-files
```

## Monorepo 分层

- `apps/api`：FastAPI 主服务。
- `modules/auth`：认证与用户上下文模块。
- `modules/items`：示例 CRUD 上下文模块。
- `packages/core`：公共基础包。
- `deploy/compose`：Docker Compose 配置。
