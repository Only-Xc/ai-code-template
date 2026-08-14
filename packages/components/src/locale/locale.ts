import type { ComponentsLocale, ComponentsLocaleCode } from './types.js'

const localeMap: Record<ComponentsLocaleCode, ComponentsLocale> = {
  ar: {
    locale: 'ar',
    messages: {},
  },
  'en-US': {
    locale: 'en-US',
    messages: {},
  },
  'zh-CN': {
    locale: 'zh-CN',
    messages: {},
  },
}

const DEFAULT_COMPONENTS_LOCALE_CODE: ComponentsLocaleCode = 'zh-CN'
const localePrefixRules: readonly (readonly [string, ComponentsLocaleCode])[] =
  [
    ['zh', 'zh-CN'],
    ['en', 'en-US'],
    ['ar', 'ar'],
  ]

function isComponentsLocaleCode(
  locale: string,
): locale is ComponentsLocaleCode {
  return locale in localeMap
}

function matchesLocalePrefix(locale: string, prefix: string) {
  return locale === prefix || locale.startsWith(`${prefix}-`)
}

export function getDefaultComponentsLocale() {
  return localeMap[DEFAULT_COMPONENTS_LOCALE_CODE]
}

export function resolveComponentsLocale(locale?: string) {
  if (!locale) return getDefaultComponentsLocale()
  if (isComponentsLocaleCode(locale)) return localeMap[locale]

  const normalizedLocale = locale.toLowerCase()
  const matchedRule = localePrefixRules.find(([prefix]) =>
    matchesLocalePrefix(normalizedLocale, prefix),
  )

  if (matchedRule) return localeMap[matchedRule[1]]

  return getDefaultComponentsLocale()
}
