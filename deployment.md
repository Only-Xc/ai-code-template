# 部署指南

项目使用 Docker Compose 部署 NestJS 后端、PostgreSQL、Redis 和 MinIO。外部流量和 HTTPS 证书由 Traefik 处理。

## 准备工作

- 准备一台可访问的服务器。
- 配置域名 DNS 记录。
- 安装 Docker Engine。
- 创建公共 Traefik 网络：

```bash
docker network create traefik-public
```

## 部署公共 Traefik

复制 Traefik Compose 文件：

```bash
mkdir -p /root/code/traefik-public/
rsync -a deploy/compose/compose.traefik.yml root@your-server.example.com:/root/code/traefik-public/
```

在服务器上设置 Traefik 环境变量：

```bash
export USERNAME=admin
export PASSWORD=changethis
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
export DOMAIN=your-domain.example.com
export EMAIL=admin@example.com
```

启动 Traefik：

```bash
cd /root/code/traefik-public/
docker compose -f compose.traefik.yml up -d
```

## 部署应用

复制代码到服务器：

```bash
rsync -av --filter=":- .gitignore" ./ root@your-server.example.com:/root/code/app/
```

设置应用环境变量：

```bash
export ENVIRONMENT=production
export DOMAIN=your-domain.example.com
export STACK_NAME=app
export DOCKER_IMAGE_BACKEND=your-registry/nestjs-backend
export POSTGRES_USER=postgres
export POSTGRES_DB=app
export POSTGRES_PASSWORD="changethis"
export OBJECT_STORAGE_ACCESS_KEY=minioadmin
export OBJECT_STORAGE_SECRET_KEY="changethis"
export BACKEND_CORS_ORIGINS="https://api.${DOMAIN?Variable not set}"
```

生产配置由当前 shell、部署平台 secret 或 Secret 管理系统注入。基础 Compose 文件 `deploy/compose/compose.yml` 只引用环境变量，后端连接通过 `DATABASE_URL`、`REDIS_URL`、`OBJECT_STORAGE_*` 注入（覆盖 YAML 默认值）。

建议使用安全随机值替换示例密码和密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

启动应用：

```bash
cd /root/code/app/
pnpm tsx scripts/deploy.ts deploy
```

`deploy` 会依次执行镜像构建、数据库迁移和服务启动。需要拆分执行时使用：

```bash
pnpm tsx scripts/deploy.ts build
pnpm tsx scripts/deploy.ts migrate
pnpm tsx scripts/deploy.ts up
```

生产环境只加载 `deploy/compose/compose.yml`，通过 shell、部署平台 secret 或 Secret 管理系统提供变量。

常用运维命令：

```bash
pnpm tsx scripts/deploy.ts status
pnpm tsx scripts/deploy.ts logs
pnpm tsx scripts/deploy.ts restart
pnpm tsx scripts/deploy.ts migrate
pnpm tsx scripts/deploy.ts down
```

更新服务器代码后重新部署：

```bash
pnpm tsx scripts/deploy.ts pull
pnpm tsx scripts/deploy.ts deploy
```

## 常用环境变量

- `PROJECT_NAME`：项目名称。
- `STACK_NAME`：Docker Compose stack 名称，作为 Traefik router 前缀。
- `DOCKER_IMAGE_BACKEND`：后端镜像名。
- `BACKEND_CORS_ORIGINS`：允许访问 API 的 origins，多个值用逗号分隔。
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`：PostgreSQL 连接参数，组成 `DATABASE_URL`。
- `REDIS_URL`：Redis 连接地址（Compose 内固定 `redis://redis:6379/0`）。
- `OBJECT_STORAGE_ACCESS_KEY` / `OBJECT_STORAGE_SECRET_KEY`：MinIO 根凭据。
- `OBJECT_STORAGE_BUCKET`：默认桶名。

## URL

把下面示例中的 `your-domain.example.com` 替换成你的域名。

- Traefik UI：`https://traefik.your-domain.example.com`
- API 文档：`https://api.your-domain.example.com/api`
- API 基础地址：`https://api.your-domain.example.com`
