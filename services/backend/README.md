# @template/backend

NestJS 后端应用（Fastify 运行时），提供业务 API、Prisma 持久层与统一响应格式。

## 技术栈

- **框架**：NestJS 11
- **运行时**：Fastify 5
- **语言**：TypeScript 5
- **持久层**：Prisma 7 + PostgreSQL（`@prisma/adapter-pg`）
- **缓存**：Redis（`@nestjs/cache-manager` + Keyv，`CACHE_MANAGER` 注入）
- **对象存储**：MinIO / S3 兼容（`@aws-sdk/client-s3`，`StorageService` 注入）
- **测试**：Jest

连接配置位于 `src/config/envs/*.yaml`（database / redis / storage），生产环境可用 `DATABASE_URL`、`REDIS_URL`、`OBJECT_STORAGE_*` 环境变量覆盖。

## 开发

```bash
# 安装依赖（在 monorepo 根目录执行）
pnpm install

# 初始化数据库（生成 Prisma Client 并应用迁移）
pnpm --filter @template/backend prisma:generate
pnpm --filter @template/backend prisma:migrate

# 开发模式（在 monorepo 根目录执行）
pnpm --filter @template/backend start:dev

# 或者直接在当前目录执行
pnpm start:dev

# 生产模式
pnpm --filter @template/backend start:prod
```

默认监听端口：`3000`（可通过环境变量 `PORT` 覆盖）

## 测试

```bash
# 单元测试
pnpm --filter @template/backend test

# 测试覆盖率
pnpm --filter @template/backend test:cov

# e2e 测试
pnpm --filter @template/backend test:e2e
```

## 目录结构

```
src/
├── app.module.ts           # 根模块
├── main.ts                 # 入口（Fastify 适配器、全局过滤器/拦截器/校验）
├── swagger.ts              # Swagger 文档
├── health.controller.ts    # 健康检查 / 就绪探针（/api/health、/api/readyz）
├── common/                 # 异常定义、全局过滤器、响应拦截器
├── config/                 # YAML 环境配置（base + dev/test/prod 覆盖，支持环境变量覆盖）
├── prisma/                 # PrismaService（PostgreSQL 适配器）
├── storage/                # MinIO / S3 兼容对象存储（StorageService）
└── auth/                   # 认证与用户管理（JWT + Redis refresh / Argon2）
```

## 构建

```bash
pnpm --filter @template/backend build
# 产物输出到 dist/
```

## 代码规范

- `oxlint` 负责后端 lint
- `oxfmt` 负责后端格式化
- 共享配置位于 `packages/tooling`
