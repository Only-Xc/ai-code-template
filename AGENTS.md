# @template/nestjs 仓库协作指南

本文件用于保存本仓库的常驻规则，处理本仓库任务时默认应遵守这些约定。

## 作用范围

除非更深层目录存在新的 `AGENTS.md` 覆盖，否则这些规则对整个仓库生效。

## 仓库概览

- 本仓库使用 pnpm monorepo + turbo，包名统一 `@template/*` scope
- 工作区包位于 `apps/*` 和 `packages/*`
- 主要应用：
  - `apps/backend`：`@template/backend`，NestJS 后端（Fastify + Prisma + Redis + MinIO）
- 共享工具与配置包：
  - `packages/tooling`：`@template/tooling`，共享 lint / format / tsconfig
  - `packages/utils`：`@template/utils`，基础工具库（number / request / storage / websocket）
- 部署与运维脚本位于根目录 `scripts/`（deploy / dev / verify，tsx 运行）

## 核心约定

- 优先做聚焦、最小化的改动，避免无关的大范围重构
- 在引入新抽象前，先复用已有模式
- 仓库级行为应集中管理，不要在各应用中重复维护
- 遇到非简单任务时，先查看目标应用及其 `README.md`

## 工具链

- 共享 lint / format 规则统一放在 `packages/tooling`
- 根目录 `.vscode/` 和 `.editorconfig` 负责编辑器默认配置
- 除非有非常明确且充分的理由，不要重新引入 Prettier

### 后端

- 后端包名为 `@template/backend`
- 后端运行时使用 Fastify（`ignoreTrailingSlash: true`），接口版本控制用 `VersioningType.URI`
- 后端环境通过 `RUNNING_ENV` 选择（dev / test / prod）
- 跨平台环境变量脚本应使用 `cross-env`
- 后端 YAML 配置文件位于 `apps/backend/src/config/envs`
- 若运行时依赖 YAML 资源，构建产物必须把它们复制到 `dist`

## 基础设施约定

- **数据库**：PostgreSQL + Prisma 7（`@prisma/adapter-pg`），统一走 `PrismaService`；schema 变更走 `prisma:migrate`（版本化迁移），不用 `db push`
- **缓存**：`@nestjs/cache-manager`（`CACHE_MANAGER`），KeyvRedis 连接配置在 `app.module.ts`；业务注入 `CACHE_MANAGER` 使用 `get/set`
- **限流**：登录限流用 `CACHE_MANAGER` 计数器（`rate-limit.guard.ts`），key=`ratelimit:{path}:{client_ip}`
- **对象存储**：MinIO / S3 兼容，`StorageService` 提供 put/get/delete/ensureBucket/presigned
- **连接配置**：`database`/`redis`/`storage` 位于 YAML，生产用 `DATABASE_URL`/`REDIS_URL`/`OBJECT_STORAGE_*`/`JWT_SECRET` 环境变量覆盖

## Auth 模块约定

- 契约对齐 fastapi auth：路径 `/api/v1/*`（URI 版本化 `version: '1'`）、字段 snake_case、`user` 表（UUID、无 updated_at）
- 令牌：JWT access + Redis refresh（key=`auth:refresh-token:{sha256}`，旋转、登出幂等）
- 密码：Argon2 主哈希 + bcrypt 兼容迁移；用户不存在时对 DUMMY_HASH 校验防时序枚举
- 当前用户挂载走 Passport：`JwtStrategy` 校验并挂 `request.user`，控制器用 `@CurrentUser()` 取用
- 错误语义：业务错误抛 `ResponseException`（HTTP 200 + code），协议错误用 HTTP 状态码
- 初始管理员用 `db:seed` 创建/更新（配置 `auth.initialAdmin*`）

## 配置规则

- 优先使用 Nest `ConfigModule`，不要把 `process.env` 读取散落在各处
- YAML 加载逻辑必须同时兼容源码运行和 `dist` 编译产物运行
- 模块级可复用辅助函数优先使用具名 `function` 声明
- 注意 `merge` 一类工具可能修改原对象，避免污染缓存的源配置对象

## 验证方式

- 先跑最窄、最相关的命令，再逐步扩大到工作区级验证
- 常用命令：
  - `pnpm --filter @template/backend build` / `typecheck` / `lint:check` / `format:check` / `test` / `test:e2e`
  - `pnpm --filter @template/backend prisma:migrate` / `prisma:migrate:deploy` / `db:seed`
  - 根级质量门禁：`pnpm verify`（fast）或 `pnpm verify:full`
  - 本地依赖服务：`pnpm dev:compose-up` / `dev:compose-down`
