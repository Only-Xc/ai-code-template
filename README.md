# @template/nestjs

NestJS 后端模板，基于 pnpm workspace + turbo 的 monorepo，开箱即用的脚手架：统一命名、共享 lint/format/tsconfig、Prisma 持久层、YAML 环境配置、统一响应信封与异常过滤器。

## 项目结构

```
nestjs/
├── apps/
│   └── backend/            # @template/backend — NestJS 后端（Fastify 运行时）
│       ├── src/
│       │   ├── common/     # 异常 / 过滤器 / 响应拦截器
│       │   ├── config/     # YAML 环境配置（base + dev/prod/test 覆盖，支持环境变量覆盖）
│       │   ├── prisma/     # PrismaService（PostgreSQL 适配器）
│       │   ├── storage/    # MinIO / S3 兼容对象存储（StorageService）
│       │   └── auth/       # 认证与用户管理（JWT + Redis refresh / Argon2）
│       ├── prisma/         # Prisma schema、模型与迁移
│       ├── Dockerfile      # 多阶段构建
│       └── test/           # e2e 测试（Jest + Supertest）
├── deploy/
│   └── compose/            # compose.yml（生产）/ override.yml（本地）/ traefik.yml（反代）
├── packages/
│   ├── tooling/            # @template/tooling — 共享 eslint / tsconfig / lint 配置
│   └── utils/              # @template/utils — 基础工具库（number / request / storage / websocket）
├── scripts/                # deploy / dev / verify 任务脚本（tsx）
├── deployment.md           # 部署指南
├── package.json
└── pnpm-workspace.yaml
```

## 技术栈

| 层级     | 技术                                          |
| -------- | --------------------------------------------- |
| 框架     | NestJS 11 · Fastify 5                         |
| 语言     | TypeScript 6                                  |
| 持久层   | Prisma 7 · PostgreSQL（`@prisma/adapter-pg`） |
| 缓存     | Redis（`@nestjs/cache-manager` + Keyv）       |
| 对象存储 | MinIO / S3 兼容（`@aws-sdk/client-s3`）       |
| 配置     | YAML 环境文件 + `ConfigModule` + 环境变量覆盖 |
| 部署     | Docker Compose · Traefik（HTTPS）             |
| 规范     | Oxlint · Oxfmt · ESLint（共享配置）           |
| 包管理   | pnpm workspace · Turbo                        |

## 快速开始

**前置要求**：Node.js >= 20，pnpm >= 10

```bash
# 安装依赖
pnpm install

# 启动本地依赖服务（postgres / redis / minio，需 Docker）
pnpm dev:compose-up

# 初始化数据库（生成 Prisma Client 并应用迁移）
pnpm --filter @template/backend prisma:generate
pnpm --filter @template/backend prisma:migrate

# 启动后端（开发模式，端口 3000）
pnpm --filter @template/backend start:dev
```

启动后访问：

- 健康检查：<http://localhost:3000/api/health>
- 就绪探针：<http://localhost:3000/api/readyz>
- Swagger 文档：<http://localhost:3000/api>

## 常用命令

```bash
# 后端
pnpm --filter @template/backend build
pnpm --filter @template/backend typecheck
pnpm --filter @template/backend lint
pnpm --filter @template/backend format:check
pnpm --filter @template/backend test
pnpm --filter @template/backend test:e2e

# 根级全量
pnpm lint
pnpm typecheck
pnpm format:check
```

## 命名规范

所有工作区包统一使用 `@template/*` scope。复制模板到新项目后，把 `@template` 替换成项目 scope：

| 包                  | 作用                                                 |
| ------------------- | ---------------------------------------------------- |
| `@template/backend` | NestJS 后端应用                                      |
| `@template/tooling` | 共享 lint / format / tsconfig 配置                   |
| `@template/utils`   | 基础工具库（number / request / storage / websocket） |

## 后端约定

- **环境配置**：运行时选择 `RUNNING_ENV`，YAML 文件位于 `apps/backend/src/config/envs`，通过 `ConfigModule` 加载，避免散落 `process.env`
- **响应格式**：全局 `ResponseInterceptor` 统一包装为 `{ code, message, success, data }`；业务错误抛 `ResponseException`，其余异常由全局过滤器处理
- **持久层**：统一走 `PrismaService`，连接 PostgreSQL，连接串由 `database.url` 配置（生产可用 `DATABASE_URL` 覆盖）
