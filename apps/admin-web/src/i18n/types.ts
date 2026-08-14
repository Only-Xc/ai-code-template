import type { Locale } from 'antd/es/locale'

export type LocaleCode = 'zh-CN' | 'en-US' | 'ar'
export type DayjsLocaleCode = 'zh-cn' | 'en' | 'ar'

export type LocaleDirection = 'ltr' | 'rtl'

export interface LocaleConfig {
  code: LocaleCode
  label: string
  direction: LocaleDirection
  antdLocale: Locale
  dayjsLocale: DayjsLocaleCode
}

export type LocaleResource = Record<string, unknown>

export type LocaleResourceBundle = LocaleResource
