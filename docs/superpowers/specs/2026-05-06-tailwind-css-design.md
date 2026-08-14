# Tailwind CSS 接入设计

## 背景

当前 monorepo 包含一个前端应用 `apps/admin-web`，使用 Vite、React 19、Ant Design 6，并通过 `src/main.tsx` 引入 `src/index.css`。当前项目处于 Tailwind CSS 接入前状态。

本次设计为 `admin-web` 添加 Tailwind CSS 工具类能力，并保持 workspace 版本统一。

## 目标

- 在 `admin-web` 中启用 Tailwind CSS。
- 使用 Tailwind CSS 官方 Vite 插件接入构建流程。
- 通过 root `pnpm-workspace.yaml` 的 `catalog` 统一 Tailwind 相关包版本。
- 应用的 `package.json` 使用 `catalog:` 引用 Tailwind 依赖。
- 应用继续使用 `src/index.css` 作为全局样式入口。
- 关闭 Tailwind Preflight，保留 Ant Design 和现有全局 CSS 的基础元素样式控制权。

## 实现范围

本次改动只覆盖 Tailwind CSS 接入：

- workspace catalog 依赖声明
- 应用 devDependencies
- 应用 Vite 插件配置
- 应用 CSS 入口
- lockfile 中 Tailwind 相关依赖解析结果
- 构建和类型检查验证

页面结构、业务组件、Ant Design 主题配置、现有页面 CSS 迁移由后续任务处理。

## 推荐方案

采用 root catalog 统一版本，并在应用本地完成 Vite 与 CSS 入口接入。

依赖版本集中在 `pnpm-workspace.yaml`：

```yaml
catalog:
  tailwindcss: ^4.2.4
  "@tailwindcss/vite": ^4.2.4
```

应用声明自身需要 Tailwind 构建能力：

```json
{
  "devDependencies": {
    "tailwindcss": "catalog:",
    "@tailwindcss/vite": "catalog:"
  }
}
```

这个方案保持 monorepo 版本一致，同时保留 `admin-web` 独立构建和独立入口的清晰边界。

## 依赖管理

在 root `pnpm-workspace.yaml` 的 `catalog` 中添加：

```yaml
tailwindcss: ^4.2.4
"@tailwindcss/vite": ^4.2.4
```

在 `apps/admin-web/package.json` 的 `devDependencies` 中添加：

```json
{
  "@tailwindcss/vite": "catalog:",
  "tailwindcss": "catalog:"
}
```

执行 `pnpm install` 更新 `pnpm-lock.yaml`。当前工作区已有 lockfile 改动，实施时需要保留已有 lockfile 内容，并只合入 Tailwind 依赖解析产生的新增变化。

## Vite 接入

应用的 `vite.config.ts` 引入 Tailwind Vite 插件：

```ts
import tailwindcss from '@tailwindcss/vite'
```

插件顺序：

```ts
plugins: [tailwindcss(), react(), babel({ presets: [reactCompilerPreset()] })]
```

Tailwind 插件负责处理 Tailwind CSS 编译能力。React 插件和 React Compiler 继续沿用当前配置。

## CSS 入口

应用继续使用现有入口：

- `apps/admin-web/src/index.css`

在文件顶部添加：

```css
@layer theme, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

@source './';
```

CSS 入口只导入 `theme.css` 和 `utilities.css`，让 Preflight 保持关闭。`@source './';` 显式声明扫描当前应用 `src` 目录下的源码。现有 `:root`、`body`、`#root`、标题、代码块等全局样式继续保留。

## Ant Design 兼容策略

Tailwind 在本项目中定位为工具类能力，主要用于：

- 布局
- 间距
- 尺寸
- Flex/Grid
- 响应式
- 少量局部视觉辅助

Ant Design 继续负责组件样式、组件状态和组件 token。关闭 Preflight 可以减少全局元素规则对 Ant Design 组件和现有 CSS 的影响。

## 文件改动

```text
pnpm-workspace.yaml
pnpm-lock.yaml
apps/admin-web/
  package.json
  vite.config.ts
  src/index.css
```

## 验证策略

实施后执行：

```bash
pnpm --filter @ai-app/admin-web typecheck
pnpm --filter @ai-app/admin-web lint
pnpm --filter @ai-app/admin-web format:check
pnpm --filter @ai-app/admin-web build
```

源码检查：

- 应用的 `vite.config.ts` 包含 `@tailwindcss/vite` 插件。
- 应用的 `src/index.css` 包含 `theme.css` 和 `utilities.css` 引入。
- 应用的 `src/index.css` 包含 `@source './';`。
- 应用的 `src/index.css` 保持 Preflight 关闭。
- 应用的 `package.json` 通过 `catalog:` 引用 Tailwind 相关包。
- lint 和 format 检查可以接受 Tailwind v4 CSS 指令。

## 验证类名策略

实施计划中可以选择一个很小的 Tailwind 类名验证点，例如在示例按钮或容器上添加视觉变化极小的工具类。

验证类名用于确认 Tailwind 编译链路正常。验证完成后，页面示例代码保留或移除该类名由实施计划明确处理。

## 验收标准

- `admin-web` 可以在 React 组件中使用 Tailwind 工具类。
- 应用构建通过。
- 应用类型检查通过。
- 应用 lint 通过。
- 应用 format check 通过。
- Tailwind 依赖版本由 workspace catalog 统一管理。
- Tailwind Preflight 保持关闭。
- 现有 Ant Design 样式和当前全局 CSS 继续按原入口加载。
