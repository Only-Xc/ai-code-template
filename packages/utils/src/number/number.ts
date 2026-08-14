import BigNumber from 'bignumber.js'

BigNumber.config({
  DECIMAL_PLACES: 20,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-20, 20],
})

const DEFAULT_COMPACT_THRESHOLD = 1000
const DEFAULT_CURRENCY = 'CNY'
const DEFAULT_DECIMALS = 2
const DEFAULT_LOCALE = 'zh-CN'

const COMPACT_UNITS = {
  B: new BigNumber(1000000000),
  K: new BigNumber(1000),
  M: new BigNumber(1000000),
  T: new BigNumber(1000000000000),
} as const

/**
 * number 工具支持的输入类型。
 */
export type NumberInput = BigNumber | number | string | null | undefined

/**
 * 通用数字格式化配置。
 */
export interface NumberFormatOptions {
  decimals?: number
  keepTrailingZeros?: boolean
  prefix?: string
  suffix?: string
  useGrouping?: boolean
}

/**
 * 百分比格式化配置。
 */
export type PercentFormatOptions = NumberFormatOptions

/**
 * 百分比计算配置。
 */
export interface PercentCalculateOptions {
  decimals?: number
}

/**
 * 货币格式化配置。
 */
export interface CurrencyFormatOptions {
  currency?: string
  decimals?: number
  keepTrailingZeros?: boolean
  locale?: string
  showSymbol?: boolean
}

/**
 * 紧凑数字格式化配置。
 */
export interface CompactFormatOptions extends NumberFormatOptions {
  forceUnit?: keyof typeof COMPACT_UNITS
  threshold?: number
}

/**
 * 数字合法性校验配置。
 */
export interface ValidNumberOptions {
  allowNegative?: boolean
  allowZero?: boolean
}

function addGrouping(value: string) {
  const sign = value.startsWith('-') ? '-' : ''
  const unsigned = sign ? value.slice(1) : value
  const [integerPart, decimalPart] = unsigned.split('.')
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (decimalPart === undefined) {
    return `${sign}${groupedInteger}`
  }

  return `${sign}${groupedInteger}.${decimalPart}`
}

function applyAffixes(value: string, prefix = '', suffix = '') {
  return `${prefix}${value}${suffix}`
}

function formatRoundedNumber(
  value: BigNumber,
  decimals: number,
  keepTrailingZeros: boolean,
) {
  if (keepTrailingZeros) {
    return value.toFixed(decimals)
  }

  return value.decimalPlaces(decimals).toFixed()
}

function getCompactUnit(value: BigNumber): keyof typeof COMPACT_UNITS {
  const absValue = value.abs()

  if (absValue.isGreaterThanOrEqualTo(COMPACT_UNITS.T)) {
    return 'T'
  }

  if (absValue.isGreaterThanOrEqualTo(COMPACT_UNITS.B)) {
    return 'B'
  }

  if (absValue.isGreaterThanOrEqualTo(COMPACT_UNITS.M)) {
    return 'M'
  }

  return 'K'
}

function normalizeDecimals(
  value: number | undefined,
  fallback = DEFAULT_DECIMALS,
) {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isInteger(value)
  ) {
    return fallback
  }

  return value
}

function normalizeThreshold(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_COMPACT_THRESHOLD
  }

  return value
}

function toNumericValue(value: BigNumber) {
  const numericValue = Number(value.toString())

  if (Number.isFinite(numericValue)) {
    return numericValue
  }

  return undefined
}

function formatNumberCore(
  value: BigNumber,
  {
    decimals = DEFAULT_DECIMALS,
    keepTrailingZeros = false,
    prefix = '',
    suffix = '',
    useGrouping = true,
  }: NumberFormatOptions = {},
) {
  const safeDecimals = normalizeDecimals(decimals)
  const rounded = formatRoundedNumber(value, safeDecimals, keepTrailingZeros)
  const formattedValue = useGrouping ? addGrouping(rounded) : rounded

  return applyAffixes(formattedValue, prefix, suffix)
}

/**
 * 将输入值统一转换为 `BigNumber`。
 *
 * @example
 * toBigNumber(123.45)
 * toBigNumber('123.45')
 * toBigNumber(null)
 */
export function toBigNumber(value: NumberInput) {
  if (value instanceof BigNumber) {
    return value
  }

  if (value === '' || value === null || value === undefined) {
    return new BigNumber(0)
  }

  const result = new BigNumber(value)

  if (result.isNaN()) {
    return new BigNumber(0)
  }

  return result
}

export const numberUtils = {
  /**
   * 按分子和分母计算百分比数值。
   *
   * @example
   * numberUtils.calculatePercent(1, 4) // 25
   * numberUtils.calculatePercent(1, 3, { decimals: 2 }) // 33.33
   */
  calculatePercent(
    value: NumberInput,
    total: NumberInput,
    { decimals = DEFAULT_DECIMALS }: PercentCalculateOptions = {},
  ) {
    const totalValue = toBigNumber(total)

    if (totalValue.isZero()) {
      return 0
    }

    const percent = toBigNumber(value)
      .dividedBy(totalValue)
      .multipliedBy(100)
      .decimalPlaces(normalizeDecimals(decimals))

    return percent.toNumber()
  },

  /**
   * 将数字按指定小数位向上取整。
   *
   * @example
   * numberUtils.ceil(1.231, 2) // "1.24"
   * numberUtils.ceil(-1.231, 2) // "-1.23"
   */
  ceil(value: NumberInput, decimals = DEFAULT_DECIMALS) {
    const safeDecimals = normalizeDecimals(decimals)
    const multiplier = new BigNumber(10).pow(safeDecimals)

    return toBigNumber(value)
      .multipliedBy(multiplier)
      .integerValue(BigNumber.ROUND_CEIL)
      .dividedBy(multiplier)
      .toFixed()
  },

  /**
   * 将数字按指定小数位向下取整。
   *
   * @example
   * numberUtils.floor(1.239, 2) // "1.23"
   * numberUtils.floor(-1.231, 2) // "-1.24"
   */
  floor(value: NumberInput, decimals = DEFAULT_DECIMALS) {
    const safeDecimals = normalizeDecimals(decimals)
    const multiplier = new BigNumber(10).pow(safeDecimals)

    return toBigNumber(value)
      .multipliedBy(multiplier)
      .integerValue(BigNumber.ROUND_FLOOR)
      .dividedBy(multiplier)
      .toFixed()
  },

  /**
   * 将数字格式化为紧凑单位表示，支持 `K / M / B / T`。
   *
   * @example
   * numberUtils.formatCompact(1234) // "1.23K"
   * numberUtils.formatCompact(1234567, { decimals: 1 }) // "1.2M"
   * numberUtils.formatCompact(900, { threshold: 800 }) // "0.9K"
   */
  formatCompact(
    value: NumberInput,
    {
      decimals = DEFAULT_DECIMALS,
      forceUnit,
      keepTrailingZeros = false,
      prefix = '',
      suffix = '',
      threshold = DEFAULT_COMPACT_THRESHOLD,
      useGrouping = true,
    }: CompactFormatOptions = {},
  ) {
    const numberValue = toBigNumber(value)
    const unit =
      forceUnit && COMPACT_UNITS[forceUnit] !== undefined
        ? forceUnit
        : undefined
    const safeThreshold = normalizeThreshold(threshold)

    if (unit === undefined && numberValue.abs().isLessThan(safeThreshold)) {
      return formatNumberCore(numberValue, {
        decimals,
        keepTrailingZeros,
        prefix,
        suffix,
        useGrouping,
      })
    }

    const resolvedUnit = unit ?? getCompactUnit(numberValue)
    const base = COMPACT_UNITS[resolvedUnit]

    return formatNumberCore(numberValue.dividedBy(base), {
      decimals,
      keepTrailingZeros,
      prefix,
      suffix: `${resolvedUnit}${suffix}`,
      useGrouping,
    })
  },

  /**
   * 将数字格式化为货币字符串。
   *
   * @example
   * numberUtils.formatCurrency(99.9) // "¥99.90"
   * numberUtils.formatCurrency(99.9, { currency: 'USD' }) // "$99.90"
   * numberUtils.formatCurrency(99.9, { showSymbol: false }) // "CNY 99.90"
   */
  formatCurrency(
    value: NumberInput,
    {
      currency = DEFAULT_CURRENCY,
      decimals = DEFAULT_DECIMALS,
      keepTrailingZeros = true,
      locale = DEFAULT_LOCALE,
      showSymbol = true,
    }: CurrencyFormatOptions = {},
  ) {
    const safeDecimals = normalizeDecimals(decimals)
    const rounded = toBigNumber(value).decimalPlaces(safeDecimals)
    const numericValue = toNumericValue(rounded)
    const minimumFractionDigits = keepTrailingZeros ? safeDecimals : 0

    if (numericValue !== undefined) {
      return new Intl.NumberFormat(locale, {
        currency,
        currencyDisplay: showSymbol ? 'symbol' : 'code',
        maximumFractionDigits: safeDecimals,
        minimumFractionDigits,
        style: 'currency',
      }).format(numericValue)
    }

    const formattedNumber = formatNumberCore(rounded, {
      decimals: safeDecimals,
      keepTrailingZeros,
      useGrouping: true,
    })

    return `${currency} ${formattedNumber}`
  },

  /**
   * 将数字格式化为普通展示字符串，支持千分位、小数位和前后缀。
   *
   * @example
   * numberUtils.formatNumber(1234567.89) // "1,234,567.89"
   * numberUtils.formatNumber(1234.5, { keepTrailingZeros: true }) // "1,234.50"
   * numberUtils.formatNumber(1234.5, { prefix: '¥' }) // "¥1,234.5"
   */
  formatNumber(value: NumberInput, options?: NumberFormatOptions) {
    return formatNumberCore(toBigNumber(value), options)
  },

  /**
   * 将比率值格式化为百分比字符串。
   *
   * @example
   * numberUtils.formatPercent(0.1234) // "12.34%"
   * numberUtils.formatPercent(0.1234, { decimals: 1 }) // "12.3%"
   */
  formatPercent(
    value: NumberInput,
    {
      decimals = DEFAULT_DECIMALS,
      keepTrailingZeros = false,
      prefix = '',
      suffix = '%',
      useGrouping = true,
    }: PercentFormatOptions = {},
  ) {
    return formatNumberCore(toBigNumber(value).multipliedBy(100), {
      decimals,
      keepTrailingZeros,
      prefix,
      suffix,
      useGrouping,
    })
  },

  /**
   * 判断输入值是否为符合约束的合法数字。
   *
   * @example
   * numberUtils.isValidNumber('12.3') // true
   * numberUtils.isValidNumber(-1, { allowNegative: false }) // false
   * numberUtils.isValidNumber(0, { allowZero: false }) // false
   */
  isValidNumber(
    value: NumberInput,
    { allowNegative = true, allowZero = true }: ValidNumberOptions = {},
  ) {
    if (value === '' || value === null || value === undefined) {
      return false
    }

    const result = new BigNumber(value)

    if (result.isNaN()) {
      return false
    }

    if (!allowNegative && result.isNegative()) {
      return false
    }

    if (!allowZero && result.isZero()) {
      return false
    }

    return true
  },

  /**
   * 将数字按指定小数位四舍五入。
   *
   * @example
   * numberUtils.round(1.235, 2) // "1.24"
   * numberUtils.round(1234.567, 1) // "1234.6"
   */
  round(value: NumberInput, decimals = DEFAULT_DECIMALS) {
    return toBigNumber(value)
      .decimalPlaces(normalizeDecimals(decimals))
      .toFixed()
  },

  /**
   * 将输入值转换为 `BigNumber`，便于在业务侧继续做高精度计算。
   *
   * @example
   * const value = numberUtils.toBigNumber('0.1')
   * value.plus('0.2').toString()
   */
  toBigNumber,
}

export type NumberUtils = typeof numberUtils
