import arEG from 'antd/locale/ar_EG'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'

import type { LocaleCode, LocaleConfig } from './types'

export const DEFAULT_LOCALE: LocaleCode = 'zh-CN'

export const LOCALE_STORAGE_KEY = 'ai-admin-locale'

export const localeConfigs: Record<LocaleCode, LocaleConfig> = {
  'zh-CN': {
    code: 'zh-CN',
    label: '简体中文',
    direction: 'ltr',
    antdLocale: zhCN,
    dayjsLocale: 'zh-cn',
  },
  'en-US': {
    code: 'en-US',
    label: 'English',
    direction: 'ltr',
    antdLocale: enUS,
    dayjsLocale: 'en',
  },
  ar: {
    code: 'ar',
    label: 'العربية',
    direction: 'rtl',
    antdLocale: arEG,
    dayjsLocale: 'ar',
  },
}

export const SUPPORTED_LOCALES = Object.keys(
  localeConfigs,
) as readonly LocaleCode[]

export const localeOptions = Object.values(localeConfigs).map(
  ({ code, label }) => ({
    code,
    label,
  }),
)
