import { useMemo } from 'react'
import { create } from 'zustand'

import {
  getDefaultComponentsLocale,
  resolveComponentsLocale,
} from './locale.js'
import type {
  ComponentsI18n,
  ComponentsI18nKey,
  ComponentsI18nValues,
  ComponentsLocale,
  ComponentsLocaleInput,
  ComponentsTranslate,
} from './types.js'

const INTERPOLATION_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g

interface ComponentsLocaleState {
  locale: ComponentsLocale
  setLocale: (locale: ComponentsLocaleInput) => void
}

function formatMessage(message: string, values?: ComponentsI18nValues) {
  if (!values) return message

  return message.replace(INTERPOLATION_PATTERN, (_, key: string) => {
    const value = values[key]

    return value == null ? '' : String(value)
  })
}

function translate(
  locale: ComponentsLocale,
  key: ComponentsI18nKey,
  values?: ComponentsI18nValues,
) {
  const message =
    locale.messages[key] ?? getDefaultComponentsLocale().messages[key] ?? key

  return formatMessage(message, values)
}

const useComponentsLocaleStore = create<ComponentsLocaleState>((set, get) => ({
  locale: getDefaultComponentsLocale(),
  setLocale: (locale) => {
    const nextLocale = resolveComponentsLocale(locale)

    if (nextLocale === get().locale) return

    set({ locale: nextLocale })
  },
}))

const selectLocale = (state: ComponentsLocaleState) => state.locale

export function useComponentsI18n(): ComponentsI18n {
  const locale = useComponentsLocaleStore(selectLocale)

  return useMemo(
    () => ({
      locale: locale.locale,
      t: ((key, values) =>
        translate(locale, key, values)) satisfies ComponentsTranslate,
    }),
    [locale],
  )
}

export function t(key: ComponentsI18nKey, values?: ComponentsI18nValues) {
  return translate(useComponentsLocaleStore.getState().locale, key, values)
}

export function getComponentsLocale() {
  return useComponentsLocaleStore.getState().locale
}

export function setComponentsLocale(locale: ComponentsLocaleInput) {
  useComponentsLocaleStore.getState().setLocale(locale)
}
