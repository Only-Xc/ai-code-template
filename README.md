# 通用后台框架模板

基于 pnpm workspace 的前端框架模板，从实际项目中拆分、清洗而来。通用框架能力保持完整，业务页面以 demo 形式提供，后续 AI 可按需扩展。

## 技术栈

- pnpm workspace monorepo + turbo 任务编排
- Vite + React 19 + TypeScript
- React Router 7：`createBrowserRouter` + auth middleware + 路由级 code-splitting
- Ant Design 6 + antd-style
- Tailwind CSS v4：CSS 变量主题，亮/暗双主题
- i18next：zh-CN / en-US / ar（含 RTL）
- zustand + TanStack Query
- 插件式 axios 请求层（`@ai-app/utils`）

## 目录结构

| 路径 | 说明 |
| ---- | ---- |
| `apps/admin-web` | 管理端应用 |
| `packages/api` | 接口声明（`createRequest` / `createApiCaller` / `path`） |
| `packages/components` | 共享组件与组件级 i18n |
| `packages/utils` | 请求层、存储、数字工具、WebSocket |
| `packages/dictionaries` | 字典 |
| `packages/tooling` | 工程化工具链 |

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:5173`。`/` 重定向到 `/dashboard`，未登录访问受保护路由会跳转 `/login`。

## 常用命令

| 命令 | 作用 |
| ---- | ---- |
| `pnpm dev` | 启动 admin-web 开发服务 |
| `pnpm build` | 全量构建 |
| `pnpm lint` | oxlint + eslint |
| `pnpm typecheck` | 各包类型检查 |
| `pnpm typecheck:root` | 根 tsconfig 引用检查 |
| `pnpm format` | 格式化并自动修复 |
| `pnpm format:check` | 格式检查 |

## 新增页面

1. 在 `apps/admin-web/src/pages/<name>/` 创建页面组件，默认导出组件。
2. 在 `apps/admin-web/src/router/routes.tsx` 的 `appRoutes` 注册路由，通过 `handle` 配置菜单：`title`（回退标题，必填才会出现在侧边栏）、`titleKey`（i18n key）、`icon`、`navOrder`、`hideInMenu`。
3. 侧边栏菜单由 `layouts/components/Sidebar/layoutNav.tsx` 根据路由 `handle` 自动生成。
4. 页面文案走 i18n，参考 `pages/dashboard/Dashboard.tsx`。

## 新增接口

1. 在 `packages/api/src/<domain>.ts` 用 `createRequest<TResponse, TData>(method, url, overrides)` 声明请求，动态路径用 `path\`...\`` 拼接。
2. 从 `packages/api/src/index.ts` 导出。
3. admin-web 在 `src/api/<domain>.ts` 用 `request()`（见 `_request.ts` 的 `createApiCaller`）包装为 Promise 调用。
4. 请求客户端在 `apps/admin-web/src/utils/request.ts` 组装插件（auth / i18n / dedupe / restful / error-handler），401 自动清理凭证并跳转 `/login`。

## 认证

当前为 demo mock 登录：预填账号 `admin@example.com` / `123456`，点击登录即写入 mock token 并跳转 `/dashboard`，无需后端。相关代码集中在 `apps/admin-web/src/mock/auth.ts`（mock 账号、token、用户信息），登录页与路由守卫共用，均注释「接入真实接口后请删除」。

接入真实后端时：
1. 删除 `apps/admin-web/src/mock/`。
2. 登录页 `pages/login/Login.tsx` 的 `handleSubmit` 改回调用 `loginWithPassword`（声明位于 `packages/api/src/auth.ts`，`POST /auth/login` 响应需包含 `accessToken`）。
3. 路由守卫 `router/middleware/auth.ts` 删除 mock token 短路分支，恢复通过 `GET /auth/me` 校验并写入用户信息。
4. 请求地址与代理目标在 `apps/admin-web/vite.config.ts` 的 `server.proxy` 配置。

## 新增 i18n key

在 `apps/admin-web/src/i18n/resources/{zh-CN,en-US,ar}/{common,layout,pages,routes}.ts` 三个语言文件同步添加相同 key，保持三语 key 对齐。

## 约定

- 相对导入必须带 `.js` 扩展名（ESM 要求）。
- demo 数据统一注释 `// demo 数据：接入真实接口后请删除`。
- 后端代理目标在 `apps/admin-web/vite.config.ts` 的 `server.proxy` 中配置。

## 文档

- 设计文档：`docs/superpowers/specs/`（含工程化工具链设计 `2026-08-15-engineering-tooling.md`）
- i18n 抽取提示词：`docs/i18n.md`
