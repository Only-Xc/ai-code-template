# 工程化工具链设计（ESLint / Oxlint / Oxfmt）

## 背景

monorepo 的代码质量工具由三部分组成：

- **Oxlint**：先行执行，快速跑 correctness 类规则（约 220 条）。
- **ESLint**：基于 `@ai-app/tooling` 的共享 flat config，负责 type-aware 检查、stylistic、import、React 系列规则。
- **Oxfmt**：格式化，写入与检查分离。

三者的忽略清单统一维护在 `packages/tooling/ignores.js`，eslint、oxlint、oxfmt 共用同一份，避免各工具各自维护一套。

## 工具分工与执行顺序

各包 `package.json` 的统一脚本：

```json
{
  "lint": "oxlint . && eslint . --max-warnings=0",
  "format": "oxfmt . --write && oxlint . --fix && eslint . --fix",
  "format:check": "oxfmt . --check"
}
```

- `oxlint` 先于 `eslint` 执行，负责快速的 correctness 检查与自动修复。
- ESLint 的 flat config 通过 `eslint-plugin-oxlint` 的 `flat/recommended`（放在配置数组最后）关闭已被 oxlint CLI 覆盖的约 220 条 correctness 规则，避免两个工具重复报同一类问题。
- ESLint 使用 `projectService` 做 type-aware 检查，import 解析走 `eslint-import-resolver-typescript` 的 TS resolver。

## 配置文件

```text
oxlint.config.ts                        # root，oxlint 配置
oxfmt.config.ts                         # root，oxfmt 配置
eslint.config.mjs                       # root，ESLint 入口，re-export @ai-app/tooling/eslint
packages/tooling/
  ignores.js                            # 共享忽略清单（aiAppIgnorePatterns）
  eslint/index.js                       # 共享 ESLint flat config
  package.json                          # exports ./eslint、./ignores
```

`oxlint.config.ts` 与 `oxfmt.config.ts` 都通过 `defineConfig` 声明，并引用共享忽略清单：

```ts
import { defineConfig } from 'oxlint'
import { aiAppIgnorePatterns } from '@ai-app/tooling/ignores'

export default defineConfig({
  ignorePatterns: aiAppIgnorePatterns,
})
```

`oxfmt.config.ts` 额外声明格式选项（`semi: false`、`singleQuote: true`、`printWidth: 80`、`sortPackageJson: false`），并保留 json5 / yml 的 `overrides`（这些文件保持双引号）。

## 忽略清单

`aiAppIgnorePatterns` 当前内容：

```js
export const aiAppIgnorePatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-ssr/**',
  '**/build/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.vite/**',
  'eslint.config.mjs',
]
```

`oxfmt` 运行目录下若存在 `dist` 等产物目录，`format:check` 会扫描到并失败，因此该清单是 `format:check` 在构建后仍能通过的前提。

## 版本与工程化约束

- 版本统一在 root `pnpm-workspace.yaml` 的 `catalog`：`oxlint` 与 `eslint-plugin-oxlint` 保持同一版本（插件的规则去重依赖与 CLI 版本对齐）。
- **oxfmt 需 ≥0.56**：`oxfmt.config.ts` 的自动发现从该版本起支持；0.47 只识别 `.oxfmtrc.json`。
- root `package.json` 需要 `"type": "module"`：oxlint / oxfmt 通过 ESM 加载器解析 TS 配置，缺少该字段会导致 `import { defineConfig } from 'oxlint'` 解析失败。
- root `package.json` 的 devDependencies 需要包含 `oxlint`：否则根 `node_modules` 没有 oxlint 符号链接，配置文件中 `import 'oxlint'` 无法解析。
- `@types/react` / `@types/react-dom` 通过 `pnpm-workspace.yaml` 的 `overrides` 固定版本，防止传递依赖引入类型漂移。

## turbo 集成

- `format`：`cache: false`，格式化始终执行，避免命中缓存造成假绿。
- `format:check`、`lint`、`typecheck`：可缓存，但相关配置变更通过 `globalDependencies` 使缓存失效。
- `globalDependencies` 包含 `eslint.config.mjs`、`oxlint.config.ts`、`oxfmt.config.ts`、`packages/tooling/**`。

## 验证

```bash
pnpm typecheck:root
pnpm lint
pnpm format:check
pnpm --filter @ai-app/admin-web build
```
