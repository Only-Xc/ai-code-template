# Number 工具设计

## 背景

`packages/utils` 为 `apps/admin-web` 提供共享运行时工具。当前仓库内的数值展示逻辑分散在页面级 `utils` 中，主要通过 `Intl.NumberFormat`、`toFixed()` 和手写百分比函数完成，能力边界和空值处理不统一。

参考实现提供了更完整的数值格式化与精度处理能力。本次目标是在 `@ai-app/utils` 中落地一版适合当前仓库的 number 工具，优先解决高频展示和基础精度问题。

## 目标

- 在 `packages/utils/src/number` 下新增共享 number 工具模块。
- 通过 `@ai-app/utils/number` 暴露命名空间对象 `numberUtils`。
- 根导出同步暴露 `numberUtils` 和相关类型，支持 `@ai-app/utils` 直接导入。
- 基于 `bignumber.js` 统一底层数值转换、舍入和大数处理逻辑。
- 首版覆盖高频能力：普通数字格式化、百分比、货币、紧凑单位、四舍五入、向上取整、向下取整、数值合法性判断。
- 工具函数保持纯函数行为，对非法输入返回可预测结果。
- 空态占位符由业务层决定，公共工具只返回可展示结果。

## 范围外事项

- 页面级 `'-'`、`'--'` 等空态文案封装。
- 首版批量统计函数，例如 `sum`、`average`、`clamp`。
- 日期、时间和时区格式化。
- 面向服务端 Node 场景的数值格式化适配。
- 自动替换现有页面级 formatter 调用。

## 目录结构

```text
packages/utils/
  package.json
  src/
    index.ts
    number/
      index.ts
      number.ts
```

## 模块职责

`number.ts` 负责核心实现，包含 `BigNumber` 默认配置、输入归一化、格式化辅助逻辑和 `numberUtils` 命名空间对象。

`number/index.ts` 负责 number 模块公共导出。

包级 `src/index.ts` 追加根导出，支持业务侧从包根路径直接导入。

`package.json` 追加 `./number` 子路径导出，并新增 `bignumber.js` 依赖。

## 公共 API

```ts
import { numberUtils } from '@ai-app/utils/number'

numberUtils.formatNumber(1234567.8)
numberUtils.formatPercent(0.1234, { decimals: 1 })
numberUtils.formatCurrency(99.9, { currency: 'USD' })
numberUtils.formatCompact(1234567)
numberUtils.round(1.235, 2)
```

首版 API 形态：

```ts
type NumberInput = number | string | BigNumber | null | undefined

interface NumberFormatOptions {
  decimals?: number
  keepTrailingZeros?: boolean
  prefix?: string
  suffix?: string
  useGrouping?: boolean
}

interface PercentFormatOptions extends NumberFormatOptions {}

interface CurrencyFormatOptions {
  currency?: string
  decimals?: number
  keepTrailingZeros?: boolean
  locale?: string
  showSymbol?: boolean
}

interface CompactFormatOptions extends NumberFormatOptions {
  forceUnit?: 'K' | 'M' | 'B' | 'T'
  threshold?: number
}

interface ValidNumberOptions {
  allowNegative?: boolean
  allowZero?: boolean
}

export const numberUtils: {
  toBigNumber(value: NumberInput): BigNumber
  formatNumber(value: NumberInput, options?: NumberFormatOptions): string
  formatPercent(value: NumberInput, options?: PercentFormatOptions): string
  formatCurrency(value: NumberInput, options?: CurrencyFormatOptions): string
  formatCompact(value: NumberInput, options?: CompactFormatOptions): string
  round(value: NumberInput, decimals?: number): string
  ceil(value: NumberInput, decimals?: number): string
  floor(value: NumberInput, decimals?: number): string
  isValidNumber(value: NumberInput, options?: ValidNumberOptions): boolean
}
```

## 行为约定

### 输入归一化

`toBigNumber()` 接受 `number | string | BigNumber | null | undefined`。

- `BigNumber` 直接返回。
- `null`、`undefined`、空字符串返回 `0`。
- 非法值返回 `0`。

该策略让展示函数具备稳定输出，业务层可以单独决定空态渲染。

### 普通数字格式化

`formatNumber()` 用于千分位、小数位和前后缀场景。

- 默认保留 2 位小数。
- 默认去掉无意义尾随 `0`。
- 默认开启千分位分组。
- 支持 `prefix` 和 `suffix`。
- 支持 `useGrouping: false` 关闭千分位。

示例：

```ts
numberUtils.formatNumber(1234567.89) // "1,234,567.89"
numberUtils.formatNumber(1234.5, { keepTrailingZeros: true }) // "1,234.50"
numberUtils.formatNumber(1234.5, { prefix: '¥' }) // "¥1,234.5"
```

### 百分比格式化

`formatPercent()` 按比率值处理输入。

- `0.1234` 输出 `12.34%`。
- 默认保留 2 位小数。
- 支持自定义 `suffix`，默认 `%`。
- 复用 `formatNumber()` 的小数位、尾零和前后缀逻辑。

### 货币格式化

`formatCurrency()` 面向本地化货币展示。

- 默认 `currency: 'CNY'`。
- 默认 `locale: 'zh-CN'`。
- 默认显示货币符号。
- 小数位和尾零策略由 `BigNumber` 先完成舍入，再交给 `Intl.NumberFormat` 渲染。
- `showSymbol: false` 时使用 `currencyCode` 风格或等价策略输出，保证结果仍然带货币语义。

首版优先服务页面展示，保持接口精简。

### 紧凑单位格式化

`formatCompact()` 输出 `K/M/B/T` 单位缩写。

- 默认阈值为 `1000`。
- 当绝对值小于阈值时，退回普通数字格式化。
- 支持 `forceUnit` 指定单位。
- 单位缩写固定使用英文 `K/M/B/T`。
- 支持负数、前缀、后缀和尾零控制。

示例：

```ts
numberUtils.formatCompact(1234) // "1.23K"
numberUtils.formatCompact(1234567, { decimals: 1 }) // "1.2M"
numberUtils.formatCompact(900, { threshold: 800 }) // "0.9K"
```

### 舍入函数

`round()`、`ceil()` 和 `floor()` 都返回字符串，服务展示场景。

- `round()` 使用 `BigNumber` 默认四舍五入规则。
- `ceil()` 和 `floor()` 支持指定小数位的向上、向下取整。
- 结果不强制保留尾随 `0`。

### 合法性判断

`isValidNumber()` 用于页面输入和业务参数校验。

- 默认允许负数。
- 默认允许零。
- `null`、`undefined`、空字符串判定为无效。
- 非法数值字符串判定为无效。

## 精度与依赖策略

首版统一使用 `bignumber.js`。

原因：

- 参考实现已经验证了这一路径适合通用 number 工具。
- 当前仓库存在 `toFixed()` 和普通浮点计算场景，统一底层可以减少行为差异。
- 紧凑单位、百分比和指定小数位取整都能复用同一套精度逻辑。

`BigNumber.config()` 采用保守默认配置：

- `DECIMAL_PLACES: 20`
- `ROUNDING_MODE: ROUND_HALF_UP`
- `EXPONENTIAL_AT: [-20, 20]`

## 错误处理

工具函数保持“安全默认值优先”的策略。

- 非法输入不抛异常。
- 非法值经过归一化后按 `0` 处理。
- 配置项异常值会被收敛到安全默认值，例如非法 `decimals` 回落到默认精度。
- API 对外保持同步返回值。

该策略与页面展示类工具的使用方式更一致，也便于替换仓库中现有零散 formatter。

## 测试与验证

首版补充 number 模块测试，覆盖以下场景：

- `null`、`undefined`、空字符串、非法字符串
- 正数、负数、零
- 大数与超大数
- 百分比和货币格式化
- `formatCompact()` 阈值边界与强制单位
- `round()`、`ceil()`、`floor()` 的小数位行为
- `isValidNumber()` 的负数和零选项

验证命令：

```bash
pnpm --filter @ai-app/utils typecheck
pnpm --filter @ai-app/utils lint
pnpm --filter @ai-app/utils build
```

项目引入或确认测试命令后，再补充针对 `packages/utils` 的单测执行命令。

## 后续演进

该模块稳定后，可以按业务需要继续扩展：

- 批量统计函数，例如 `sum`、`average`、`clamp`
- 页面级 formatter 逐步迁移到共享工具
- 更细粒度的货币与 locale 策略
- 面向表单输入的 parse 与 normalize 辅助函数
