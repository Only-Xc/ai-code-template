# API 服务

`apps/api` 是 FastAPI 主服务，负责应用装配、配置、数据库连接、Alembic 迁移、路由注册和启动脚本。

## 职责

- 创建 FastAPI 应用。
- 读取根目录 `.env.development` 作为团队开发配置。
- 创建数据库 engine 和 session。
- 注册 `modules/auth` 暴露的用户与登录路由。
- 保留当前 items 示例功能。
- 执行 Alembic 迁移。

## 本地运行

从仓库根目录安装依赖：

```bash
uv sync
```

启动开发服务：

```bash
python scripts/dev.py api
```

运行测试：

```bash
cd apps/api
uv run pytest
```

## Docker Compose

从仓库根目录首次启动按顺序执行：

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
  up -d --remove-orphans db mailcatcher
```

## 迁移

Alembic 配置位于 `apps/api/alembic.ini`，迁移脚本位于 `apps/api/app/alembic/`。

生成迁移：

```bash
cd apps/api
uv run alembic revision --autogenerate -m "Describe change"
```

执行迁移：

```bash
cd apps/api
uv run alembic upgrade head
```

## 首个管理员

应用启动不会自动创建超级管理员。需要初始化管理员时，由运维或开发者显式执行：

```bash
cd apps/api
python scripts/dev.py create-superuser
```

该命令读取 `FIRST_SUPERUSER` 和 `FIRST_SUPERUSER_PASSWORD`，创建或更新对应超级管理员。生产环境必须通过部署平台或 Secret 管理系统注入这些配置。

## 邮件模板

测试邮件模板留在 `apps/api/app/email-templates/`。

认证模块邮件模板位于 `modules/auth/src/fast_auth/email_templates/`。
