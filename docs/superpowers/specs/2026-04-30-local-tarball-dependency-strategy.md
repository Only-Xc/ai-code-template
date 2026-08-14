# 本地 Tarball 依赖策略

## 目的

本文档记录一套未来可采用的本地 npm tarball 依赖策略。当前 monorepo 依赖策略保持为 `workspace:*`，以支持最轻量的日常开发流程。

当多个应用需要为 `@ai-app/utils` 这类共享包分别锁定版本时，tarball 策略会发挥作用。

## 当前策略

日常开发使用 workspace 依赖：

```json
{
  "@ai-app/utils": "workspace:*"
}
```

这让本地开发保持简单。应用会消费当前 workspace 中共享包的源码版本。

## 未来 Tarball 布局

将带版本的包产物存放在仓库根目录下：

```text
releases/
  npm/
    ai-app-utils-1.0.0.tgz
    ai-app-utils-1.1.0.tgz

packages/
  utils/
  tooling/

apps/
  admin-web/
```

`packages/` 继续作为 workspace 包源码位置。`releases/npm/` 存放带版本的 npm tarball。

## 应用依赖示例

每个应用可以依赖指定 tarball 版本：

```json
{
  "dependencies": {
    "@ai-app/utils": "file:../../releases/npm/ai-app-utils-1.0.0.tgz"
  }
}
```

另一个应用可以选择更新的版本：

```json
{
  "dependencies": {
    "@ai-app/utils": "file:../../releases/npm/ai-app-utils-1.1.0.tgz"
  }
}
```

导入路径保持稳定：

```ts
import { local, session } from '@ai-app/utils/storage'
```

## 打包命令

先构建共享包，再将它打包到 `releases/npm`：

```bash
pnpm --filter @ai-app/utils build
pnpm --filter @ai-app/utils pack --pack-destination releases/npm
```

生成的 tarball 名称来自 `packages/utils/package.json` 中声明的包名和版本。

## 升级流程

1. 更新 `packages/utils` 源码。
2. 更新 `packages/utils/package.json` 版本。
3. 构建包。
4. 将新的 `.tgz` 打包到 `releases/npm`。
5. 只更新目标应用的依赖路径。
6. 运行 `pnpm install` 更新 `pnpm-lock.yaml`。
7. 对目标应用运行 typecheck、lint 和 build。
8. 将源码变更、新 tarball、应用依赖变更和 lockfile 变更一起提交。

目标应用更新示例：

```diff
- "@ai-app/utils": "file:../../releases/npm/ai-app-utils-1.0.0.tgz"
+ "@ai-app/utils": "file:../../releases/npm/ai-app-utils-1.1.0.tgz"
```

## 回滚流程

1. 将目标应用依赖路径改回上一个 `.tgz`。
2. 运行 `pnpm install` 更新 `pnpm-lock.yaml`。
3. 对目标应用运行 typecheck、lint 和 build。
4. 将回滚依赖变更和 lockfile 变更一起提交。

## Docker 要求

Docker 构建必须在 `pnpm install` 之前包含 tarball 包目录：

```dockerfile
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY releases/ releases/

RUN corepack enable
RUN pnpm install --frozen-lockfile --filter @ai-app/admin-web...

COPY . .
RUN pnpm --filter @ai-app/admin-web build
```

确保 `releases/npm/*.tgz` 位于 Docker 构建上下文内。若 `.dockerignore` 排除了宽泛的产物模式，为 tarball 包添加放行规则：

```gitignore
!releases/
!releases/npm/
!releases/npm/*.tgz
```

## 使用时机

当应用需要独立的共享包版本、明确的升级控制和无需私有 registry 的可复现 Docker 安装时，使用 tarball 策略。

当所有应用可以一起使用当前共享包版本时，继续使用 `workspace:*`。
