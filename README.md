# FastAPI Monorepo

这是一个以 FastAPI API 服务为核心的 Python monorepo。

## 目录结构

```text
.
├── apps/
│   └── api/                 # FastAPI 主服务
├── modules/
│   ├── auth/                # 认证与用户模块
│   └── items/               # 示例 CRUD 模块
├── packages/
│   └── core/                # 公共基础包
├── deploy/
│   └── compose/             # Docker Compose 配置
├── scripts/                 # 仓库级脚本
├── pyproject.toml           # uv workspace 根配置
├── uv.lock
└── .python-version
```

## 技术栈

- [FastAPI](https://fastapi.tiangolo.com)：API 服务框架
- [SQLModel](https://sqlmodel.tiangolo.com)：数据库模型和 ORM
- [Pydantic](https://docs.pydantic.dev)：数据校验和配置管理
- [PostgreSQL](https://www.postgresql.org)：关系型数据库
- [Docker Compose](https://www.docker.com)：本地开发和部署
- [Traefik](https://traefik.io)：反向代理
- [uv](https://docs.astral.sh/uv/)：Python workspace、依赖和锁文件管理
- [Ruff](https://docs.astral.sh/ruff/) 和 [Pyright](https://microsoft.github.io/pyright/)：格式化、静态检查和类型检查

## Monorepo 约定

- `apps/*` 放可运行应用。
- `modules/*` 放业务上下文模块。
- `packages/*` 放跨模块公共包。
- `deploy/*` 放部署配置。
- Python import 包名使用 `fast_<name>`，例如 `fast_auth`、`fast_core`。
- Python 版本固定为 3.11。

## 作为模板使用

复制本仓库作为新项目起点时，按以下顺序调整：

1. 改 workspace 与包名：在根 `pyproject.toml` 的 `[tool.uv.workspace].members`、`[tool.pyright].extraPaths`、`[tool.importlinter].root_packages` 中增删模块；`apps/api/pyproject.toml` 的 `dependencies` 与 `[tool.uv.sources]` 同步。
2. 按 `modules/<name>` 约定新增业务模块：目录命名 `modules/<name>`，dist 名 `fast-<name>`，import 名 `fast_<name>`，源码放 `src/fast_<name>/`。在 `scripts/module_service.py` 的 `MODULE_SERVICES` 注册模块入口、Dockerfile 与默认端口。
3. 调整环境配置：复制 `.env.development`、`.env.production`、`.env.test`，替换 `PROJECT_NAME`、`STACK_NAME`、`DOMAIN`、`BACKEND_CORS_ORIGINS`、`SECRET_KEY`、`FIRST_SUPERUSER`、`POSTGRES_*` 等。
4. 应用装配：`apps/api/app/api_router.py` 注册模块路由，`apps/api/app/platform/openapi.py` 汇总模块 OpenAPI tags，`apps/api/app/model_registry.py` 导入新模块的 SQLModel 表。

模块架构规范见 [docs/coding-rules.md](./docs/coding-rules.md) 与 [docs/fastapi-native-architecture.md](./docs/fastapi-native-architecture.md)。

## 开发

安装依赖：

```bash
uv sync
```

运行格式化和检查：

```bash
uv run ruff format apps/api modules packages
uv run ruff check apps/api modules packages
uv run pyright apps/api modules packages
```

运行 API 测试：

```bash
cd apps/api
uv run pytest
```

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

如果 Docker 依赖服务没有运行，先执行 `python scripts/dev.py compose-up`。

底层等价命令：

```bash
docker compose \
  --project-directory . \
  --env-file .env.development \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.override.yml \
  up -d --remove-orphans db mailcatcher
```

更多开发说明见 [development.md](./development.md)。

## 部署

部署说明见 [deployment.md](./deployment.md)。

## API 服务

API 服务文档见 [apps/api/README.md](./apps/api/README.md)。

## 许可证

MIT License.
