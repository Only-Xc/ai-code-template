# 开发脚本

本目录提供仓库级开发和验证入口。

## 验证脚本

开发中最小检查：

```bash
python scripts/verify.py --fast --scope "modules/items"
```

`--scope` 会映射相关测试路径，例如：

- `modules/auth` -> auth service tests + login/users API tests
- `modules/items` -> items API tests
- `packages/core` -> core package tests
- `apps/api` -> API app tests

快速检查：

```bash
python scripts/verify.py --fast
```

指定检查范围：

```bash
python scripts/verify.py --fast --scope "apps/api/app modules packages"
```

提交前完整检查：

```bash
python scripts/verify.py --full
```

`--fast` 包含：

- Ruff format check
- Ruff lint
- 相关 pytest，并排除 `slow` marker

`--full` 在 `--fast` 基础上额外包含：

- Pyright
- import-linter
- migration metadata check
- Docker backend build

## CI / 质量门禁设计

当前仓库以 `scripts/verify.py` 作为 CI 等价质量门禁入口，CI 平台可直接复用以下步骤：

1. 安装 Python 3.11。
2. 安装 uv。
3. 执行 `uv sync --frozen --all-packages --group dev` 安装 workspace 依赖。
4. 执行 `python scripts/verify.py --full`。

`python scripts/verify.py --full` 覆盖：

- Ruff format check
- Ruff lint
- 相关 pytest
- Pyright
- import-linter
- migration metadata check
- Docker backend build

CI 环境使用系统环境变量或平台 secret 注入生产配置；本地团队开发默认读取 `.env.development`。

## 开发入口

启动本地 FastAPI：

```bash
python scripts/dev.py api
```

启动本地依赖服务：

```bash
python scripts/dev.py compose-up
```

停止 Compose：

```bash
python scripts/dev.py compose-down
```

查看本地依赖服务日志：

```bash
python scripts/dev.py compose-logs
```

运行 migration：

```bash
python scripts/dev.py migrate
```

查看当前 migration revision：

```bash
python scripts/dev.py migration-current
```

创建或更新本地超级管理员：

```bash
python scripts/dev.py create-superuser
```

## 生产部署入口

生产服务器在仓库根目录执行部署脚本。脚本固定使用 `.env.production` 和 `deploy/compose/compose.yml`：

```bash
python scripts/deploy.py deploy
```

常用运维命令：

```bash
python scripts/deploy.py status
python scripts/deploy.py logs
python scripts/deploy.py restart
python scripts/deploy.py migrate
python scripts/deploy.py down
```

代码部署流程：

```bash
python scripts/deploy.py pull
python scripts/deploy.py deploy
```

`deploy` 等价于先 `build`，再运行 Alembic migration，最后 `up -d`。`migrate` 使用 backend 镜像显式执行 `alembic upgrade head`。

## 模块服务入口

模块服务使用独立脚本，复用 `apps/api` 运行壳，按模块选择 ASGI 入口和 Dockerfile：

```bash
python scripts/module_service.py list
```

本地运行单个模块服务：

```bash
python scripts/module_service.py dev auth
python scripts/module_service.py dev items --port 8013
```

启动模块服务依赖的本地 DB、Redis、MinIO、Mailcatcher：

```bash
python scripts/module_service.py compose-up
python scripts/module_service.py compose-logs
python scripts/module_service.py compose-down
```

构建模块镜像：

```bash
python scripts/module_service.py build auth --tag latest
python scripts/module_service.py build items --registry registry.example.com/platform --tag v1
```

构建并推送模块镜像：

```bash
python scripts/module_service.py deploy items --registry registry.example.com/platform --tag v1
```

本地运行已构建的模块镜像：

```bash
python scripts/module_service.py run-image auth --tag latest --env-file .env.development
```

全局 API migration 执行命令：

```bash
python scripts/module_service.py migrate-app
```
