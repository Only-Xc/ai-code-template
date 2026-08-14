import { match } from '@formatjs/intl-localematcher'
import { local } from '@ai-app/utils'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_STORAGE_KEY,
} from './constants'
import type { LocaleCode, LocaleResourceBundle } from './types'

export function isLocaleCode(value: unknown): value is LocaleCode {
  return (
    typeof value === 'string' && SUPPORTED_LOCALES.includes(value as LocaleCode)
  )
}

function normalizeLegacyLocale(value: unknown) {
  if (typeof value === 'string' && /^ar(?:[-_].+)?$/i.test(value)) return 'ar'

  return value
}

export function getSafeLocale(value: unknown): LocaleCode {
  const normalizedValue = normalizeLegacyLocale(value)

  return isLocaleCode(normalizedValue) ? normalizedValue : DEFAULT_LOCALE
}

function getBrowserLocales() {
  if (typeof navigator === 'undefined') return []

  if (navigator.languages?.length) return navigator.languages

  return navigator.language ? [navigator.language] : []
}

export function getInitialLocale() {
  const storedLocale = local.get<string>(LOCALE_STORAGE_KEY)
  const normalizedStoredLocale = normalizeLegacyLocale(storedLocale)

  if (isLocaleCode(normalizedStoredLocale)) {
    return normalizedStoredLocale
  }

  return match(
    getBrowserLocales().map(
      (locale) => normalizeLegacyLocale(locale) as string,
    ),
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
  ) as LocaleCode
}

interface LocaleResourceModule {
  default: LocaleResourceBundle
}

const resourceModules = import.meta.glob<LocaleResourceModule>(
  './resources/*.ts',
)

export function loadLocaleResources(locale: LocaleCode) {
  const modulePath = `./resources/${locale}.ts`
  const loader = resourceModules[modulePath]

  if (!loader) {
    throw new Error(`Missing locale resource: ${modulePath}`)
  }

  return loader().then((resourceModule) => resourceModule.default)
}

export async function loadLangResources(locale: LocaleCode, namespace: string) {
  if (namespace !== 'translation') {
    throw new Error(`Unsupported locale namespace: ${namespace}`)
  }

  return loadLocaleResources(locale)
}
