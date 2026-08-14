## 项目规则

- 代码生成或修改后按三层策略运行校验：
  - 先用 `git diff --name-only` 识别本次涉及路径，再映射到 workspace：`apps/admin-web` -> `@ai-app/admin-web`，`packages/api` -> `@ai-app/api`，`packages/components` -> `@ai-app/components`，`packages/dictionaries` -> `@ai-app/dictionaries`，`packages/utils` -> `@ai-app/utils`。
  - 日常代码改动只运行涉及 workspace 的校验，例如 `pnpm --filter @ai-app/api --filter @ai-app/admin-web lint` 和对应 `typecheck`。
  - 修改共享包时同时校验直接受影响应用；修改 `packages/api`、`packages/components`、`packages/dictionaries`、`packages/utils` 后，按实际引用关系补跑 `apps/admin-web`。
  - 修改根配置、锁文件、工具链、跨 workspace 公共规则，或准备提交前，运行 `npm run lint` 和 `npm run typecheck` 全量校验。
