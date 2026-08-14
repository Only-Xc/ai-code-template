import { createInstance } from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'

import { SUPPORTED_LOCALES } from './constants'
import {
  getSafeLocale,
  getInitialLocale,
  isLocaleCode,
  loadLangResources,
} from './helper'
import type { LocaleCode } from './types'

export function initI18next() {
  const i18n = createInstance()
  const initialLocale = getInitialLocale()

  i18n
    .use(
      resourcesToBackend((language: string, namespace: string) => {
        if (!isLocaleCode(language)) {
          throw new Error(`Unsupported locale resource request: ${language}`)
        }

        return loadLangResources(language, namespace)
      }),
    )
    .use(initReactI18next)

  const ready = i18n.init({
    lng: initialLocale, // 默认语言
    fallbackLng: false, // 回退语言
    supportedLngs: [...SUPPORTED_LOCALES], // 支持的语言列表
    keySeparator: false,
    load: 'currentOnly',
    interpolation: {
      escapeValue: false, // React 已经防 XSS，不需要转义
    },
    react: {
      useSuspense: false, // 不使用 Suspense（避免 SSR 问题）
    },
  })

  return {
    i18n,
    ready,
  }
}

const i18nextSetup = initI18next()

export const i18n = i18nextSetup.i18n

export async function ensureI18nReady() {
  await i18nextSetup.ready
}

export async function changeLocale(locale: LocaleCode) {
  const safeLocale = getSafeLocale(locale)

  await ensureI18nReady()
  await i18n.loadLanguages(safeLocale)
  await i18n.changeLanguage(safeLocale)

  return safeLocale
}
