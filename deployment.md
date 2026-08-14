# 部署指南

项目使用 Docker Compose 部署 API、数据库和管理服务。外部流量和 HTTPS 证书由 Traefik 处理。

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
export POSTGRES_PASSWORD="changethis"
export SECRET_KEY="changethis"
export FIRST_SUPERUSER_PASSWORD="changethis"
export BACKEND_CORS_ORIGINS="https://api.${DOMAIN?Variable not set}"
```

生产配置由当前 shell、部署平台 secret 或 Secret 管理系统注入。基础 Compose 文件 `deploy/compose/compose.yml` 只引用环境变量。

建议使用安全随机值替换示例密码和密钥：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

启动应用：

```bash
cd /root/code/app/
python scripts/deploy.py deploy
```

`deploy` 会依次执行镜像构建、数据库迁移和服务启动。需要拆分执行时使用：

```bash
python scripts/deploy.py build
python scripts/deploy.py migrate
python scripts/deploy.py up
```

生产环境通常只加载 `deploy/compose/compose.yml`，并通过 `.env.production`、当前 shell、部署平台 secret 或 Secret 管理系统提供变量。

常用运维命令：

```bash
python scripts/deploy.py status
python scripts/deploy.py logs
python scripts/deploy.py restart
python scripts/deploy.py migrate
python scripts/deploy.py down
```

更新服务器代码后重新部署：

```bash
python scripts/deploy.py pull
python scripts/deploy.py deploy
```

## 常用环境变量

- `PROJECT_NAME`：项目名称。
- `STACK_NAME`：Docker Compose stack 名称。
- `BACKEND_CORS_ORIGINS`：允许访问 API 的 origins，多个值用逗号分隔。
- `FIRST_SUPERUSER`：第一个超级用户邮箱。
- `FIRST_SUPERUSER_PASSWORD`：第一个超级用户密码。
- `SMTP_HOST`：SMTP 服务器地址。
- `SMTP_USER`：SMTP 用户名。
- `SMTP_PASSWORD`：SMTP 密码。
- `EMAILS_FROM_EMAIL`：发件邮箱。
- `POSTGRES_SERVER`：PostgreSQL 主机名，默认使用 Compose 服务名 `db`。
- `POSTGRES_PORT`：PostgreSQL 端口。
- `POSTGRES_USER`：PostgreSQL 用户名。
- `POSTGRES_DB`：应用数据库名。
- `SENTRY_DSN`：Sentry DSN。

## URL

把下面示例中的 `your-domain.example.com` 替换成你的域名。

- Traefik UI：`https://traefik.your-domain.example.com`
- API 文档：`https://api.your-domain.example.com/docs`
- API 基础地址：`https://api.your-domain.example.com`
