# admin-web i18n 功能规格

## 背景

`apps/admin-web` 已接入 `i18next`、`react-i18next`、`i18next-resources-to-backend`、`@formatjs/intl-localematcher` 和 Ant Design locale。当前 i18n 能力覆盖应用启动语言判定、运行时语言切换、语言偏好持久化、Ant Design 组件本地化、RTL/LTR 文档方向、路由标题、导航、面包屑、页面标题和业务页面文案。

本规格记录当前代码中的国际化实现，用于后续新增语言、扩展文案和排查语言切换问题。

## 目标

- 记录 `admin-web` i18n 的模块边界、初始化流程和运行时链路。
- 记录支持语言、资源结构、资源加载规则和 key 命名规则。
- 记录语言切换对 Zustand、local storage、Ant Design、HTML 属性和业务 UI 的影响。
- 记录新增语言与新增文案的落地步骤。
- 保持规格与当前代码一致。

## 技术基线

当前依赖来自 `apps/admin-web/package.json`：

- `i18next`
- `react-i18next`
- `i18next-resources-to-backend`
- `@formatjs/intl-localematcher`
- `antd`
- `zustand`
- `@ai-app/utils`

核心入口：

- `apps/admin-web/src/i18n/index.ts`
- `apps/admin-web/src/i18n/constants.ts`
- `apps/admin-web/src/i18n/helper.ts`
- `apps/admin-web/src/i18n/useLocale.ts`
- `apps/admin-web/src/store/useApp.ts`
- `apps/admin-web/src/components/AppProvider.tsx`
- `apps/admin-web/src/main.tsx`

## 支持语言

支持语言集中定义在 `localeConfigs`：

| code | label | direction | Ant Design locale |
| --- | --- | --- | --- |
| `zh-CN` | `简体中文` | `ltr` | `antd/locale/zh_CN` |
| `en-US` | `English` | `ltr` | `antd/locale/en_US` |
| `ar` | `العربية` | `rtl` | `antd/locale/ar_EG` |

默认语言为 `zh-CN`。

语言偏好存储 key 为 `ai-admin-locale`。

## 初始化流程

应用启动入口在 `src/main.tsx`：

```ts
void ensureI18nReady().then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
```

启动时先执行 `ensureI18nReady()`，等待 `i18next` 初始化完成，再渲染 React 应用。这样首屏可以直接读取初始语言资源。

`initI18next()` 使用 `createInstance()` 创建独立实例，并注册两个插件：

- `resourcesToBackend()`：通过 Vite `import.meta.glob` 按语言动态加载资源入口。
- `initReactI18next`：把 i18next 实例接入 React。

初始化配置：

```ts
{
  lng: initialLocale,
  fallbackLng: false,
  supportedLngs: [...SUPPORTED_LOCALES],
  keySeparator: false,
  load: 'currentOnly',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
}
```

配置含义：

- `lng` 来自 `getInitialLocale()`。
- `fallbackLng: false` 表示 key 缺失时由调用侧看到原 key。
- `supportedLngs` 只接受 `localeConfigs` 中声明的语言。
- `keySeparator: false` 表示翻译 key 使用扁平字符串，如 `pages.dashboard.stats.apps`。
- `load: 'currentOnly'` 表示按完整语言码加载资源，如 `zh-CN`。
- `escapeValue: false` 适配 React 的默认转义机制。
- `useSuspense: false` 让页面通过显式 ready 流程控制初始化。

## 初始语言判定

`getInitialLocale()` 的判定顺序：

1. 读取 `local.get<LocaleCode>('ai-admin-locale')`。
2. 已存储值通过 `isLocaleCode()` 校验后直接使用。
3. 从 `navigator.languages` 或 `navigator.language` 读取浏览器语言。
4. 使用 `@formatjs/intl-localematcher` 在浏览器语言和 `SUPPORTED_LOCALES` 中匹配。
5. 匹配失败时使用 `DEFAULT_LOCALE`，即 `zh-CN`。

所有外部输入都会经过 `getSafeLocale()` 归一化，保证运行时语言值落在 `LocaleCode` 联合类型内。

## 资源加载规则

资源入口由 `src/i18n/helper.ts` 维护：

```ts
const resourceModules = import.meta.glob<LocaleResourceModule>(
  './resources/*.ts',
)
```

每个语言有一个聚合入口：

```text
src/i18n/resources/
  zh-CN.ts
  en-US.ts
  ar.ts
```

聚合入口按业务域合并资源：

```ts
import common from './zh-CN/common'
import layout from './zh-CN/layout'
import pages from './zh-CN/pages'
import routes from './zh-CN/routes'

export default {
  ...common,
  ...layout,
  ...pages,
  ...routes,
}
```

当前资源域：

- `common`：应用标题、用户信息等全局文案。
- `layout`：Header、Sidebar、页面操作区文案。
- `pages`：业务页面、异常页、页面壳层文案。
- `routes`：路由标题和导航分组文案。

`loadLangResources(locale, namespace)` 当前仅接受 `translation` 命名空间，随后加载对应语言入口。传入其他 namespace 会抛出 `Unsupported locale namespace`。

语言入口缺失时，`loadLocaleResources()` 抛出 `Missing locale resource`。

## 状态与持久化

语言状态由 `src/store/useApp.ts` 的 Zustand store 管理：

```ts
interface AppState {
  locale: LocaleCode
  setLocale: (locale: LocaleCode) => Promise<void>
}
```

初始状态使用 `getInitialLocale()`。语言切换流程：

1. `setLocale(locale)` 接收目标语言。
2. `getSafeLocale(locale)` 归一化。
3. 目标语言与当前语言一致时直接结束。
4. 调用 `changeLocale(nextLocale)`。
5. 写入 local storage：`local.set(LOCALE_STORAGE_KEY, nextLocale)`。
6. 更新 Zustand state：`set({ locale: nextLocale })`。

`changeLocale()` 的执行顺序：

```ts
await ensureI18nReady()
await i18n.loadLanguages(safeLocale)
await i18n.changeLanguage(safeLocale)
```

这保证切换前语言资源已加载。

## Provider 集成

`AppProvider` 通过 `useLocale()` 读取：

- 当前 `locale`
- 文档方向 `direction`
- Ant Design locale `antdLocale`
- 语言切换方法 `setLocale`
- 语言选项 `localeOptions`

语言变化时同步 HTML 属性：

```ts
document.documentElement.lang = locale
document.documentElement.dir = direction
```

Ant Design 集成：

```tsx
<ConfigProvider direction={direction} locale={antdLocale} theme={antdTheme}>
  <AntdApp className="h-full">{children}</AntdApp>
</ConfigProvider>
```

影响范围：

- Ant Design 组件文案和日期等 locale 能力。
- 组件方向，`ar` 下使用 RTL。
- 全局 HTML `lang` 与 `dir` 属性。
- 布局中依赖 `direction` 的 Tooltip 和 Drawer 方向。

## UI 消费规则

React 组件通过 `useTranslation()` 获取 `t`：

```ts
const { t } = useTranslation()
```

典型消费位置：

- `Header`：应用标题（`common.appTitle`）、语言切换按钮、主题按钮 tooltip、用户信息。
- `AppLayout`：侧边栏收起/展开文案、浏览器标题。
- `Dashboard`：页面标题、说明文案、统计卡片和表格文案。
- `Sidebar/layoutNav`：导航分组和菜单项。
- `Dashboard`、`NotFoundPage`：页面级业务文案。

页面代码使用完整 key：

```tsx
{t('pages.dashboard.stats.apps')}
```

动态 key 当前用于有限枚举场景：

```tsx
{t(`pages.dashboard.stats.${stat.key}`)}
```

动态 key 需要保证枚举值与资源 key 后缀保持一致。

## 路由文案规则

路由 meta 在 `src/router/routes.tsx` 中定义：

```ts
interface RouteMeta {
  title?: string
  titleKey?: string
  subtitleKey?: string
  icon?: ReactNode
  layout?: boolean
  hideInMenu?: boolean
  hideInBreadcrumb?: boolean
  menuType?: 'catalog' | 'menu'
  menuMode?: 'group' | 'submenu'
  navKey?: string
  navOrder?: number
}
```

路由标题解析由 `getRouteTitle(meta, t)` 负责：

1. 优先读取 `meta.titleKey`。
2. `t(meta.titleKey)` 返回有效翻译时使用翻译值。
3. 翻译 key 缺失时使用 `meta.title`。
4. 兜底返回空字符串。

侧边栏导航由 `layouts/components/Sidebar/layoutNav.tsx` 根据路由 meta 生成：`titleKey`/`title` 作为菜单文案，`icon` 与 `navOrder` 控制图标和排序，`menuType`/`menuMode` 决定分组类型，`hideInMenu` 控制是否出现在菜单。

面包屑由 `buildBreadcrumbs(routes, pathname, t)` 生成，并通过 `hideInBreadcrumb` 控制展示。

浏览器标题由 `AppLayout` 中的 effect 生成：

```ts
document.title = title ? `${title} - ${appTitle}` : appTitle
```

其中 `appTitle` 来自 `common.appTitle`。

## 语言切换入口

Header 中的语言按钮使用 Ant Design `Dropdown`：

```tsx
const localeItems: MenuProps['items'] = localeOptions.map((option) => ({
  key: option.code,
  label: option.label,
}))
```

点击菜单项时：

```ts
void setLocale(key as typeof locale)
```

`localeOptions` 来源于 `localeConfigs`，新增语言后会自动进入语言菜单。

## 新增文案规则

新增业务文案时按所属域放入资源文件：

- 全局品牌、用户、通用标签：`common.ts`
- Layout、Header、Sidebar、页面操作：`layout.ts`
- 页面正文、页面卡片、页面状态：`pages.ts`
- 路由标题、导航分组：`routes.ts`

key 命名建议：

- 使用扁平 key。
- 使用模块前缀，如 `pages.dashboard.*`、`layout.header.*`、`routes.*`。
- 页面状态枚举使用固定后缀，如 `pages.dashboard.status.running`。
- 三个语言目录保持 key 集合一致。

新增文案后，组件通过 `t('完整 key')` 使用。

## 新增语言规则

新增语言需要完成以下文件与配置：

1. 在 `LocaleCode` 中加入语言码。
2. 在 `localeConfigs` 中加入 `code`、`label`、`direction`、`antdLocale`。
3. 新增 `src/i18n/resources/<locale>.ts` 聚合入口。
4. 新增 `src/i18n/resources/<locale>/common.ts`。
5. 新增 `src/i18n/resources/<locale>/layout.ts`。
6. 新增 `src/i18n/resources/<locale>/pages.ts`。
7. 新增 `src/i18n/resources/<locale>/routes.ts`。
8. 对照现有三种语言补齐相同 key。
9. 执行类型检查、lint 和构建验证。

`SUPPORTED_LOCALES`、语言菜单和资源动态加载会从上述配置自动获得新增语言。

## 错误与边界

当前实现中的显式边界：

- 语言码通过 `isLocaleCode()` 和 `getSafeLocale()` 校验。
- `resourcesToBackend()` 收到未知语言时抛出 `Unsupported locale resource request`。
- 资源入口缺失时抛出 `Missing locale resource`。
- namespace 仅接受 `translation`，其他 namespace 抛出 `Unsupported locale namespace`。
- 路由标题和导航分组在翻译缺失时回退到路由 meta 中的中文静态值。

当前实现依赖 `ensureI18nReady()` 控制首屏初始化。运行时语言切换失败会导致 `setLocale()` promise reject，Header 调用方当前使用 `void setLocale(...)`，界面层暂未展示切换失败提示。

## 验证策略

i18n 相关变更完成后执行：

```bash
pnpm --filter @ai-app/admin-web typecheck
pnpm --filter @ai-app/admin-web lint
pnpm --filter @ai-app/admin-web build
```

人工验证范围：

- 首次进入页面时使用 local storage 语言偏好。
- 清空 `ai-admin-locale` 后使用浏览器语言匹配。
- Header 语言菜单能在 `zh-CN`、`en-US`、`ar` 之间切换。
- `ar` 下 `html.dir` 为 `rtl`，Ant Design 组件方向同步为 RTL。
- 页面标题、侧边栏、面包屑、Header、业务卡片文案随语言切换更新。
- 刷新页面后保持上一次选择的语言。
