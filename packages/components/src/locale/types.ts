export type ComponentsLocaleCode = 'zh-CN' | 'en-US' | 'ar'
export type ComponentsLocaleInput = ComponentsLocaleCode | (string & {})
export type ComponentsI18nValue = boolean | number | string | null | undefined
export type ComponentsI18nValues = Record<string, ComponentsI18nValue>
export type ComponentsI18nMessages = Record<string, string>
export type ComponentsI18nKey = string
export type ComponentsTranslate = (
  key: ComponentsI18nKey,
  values?: ComponentsI18nValues,
) => string

export interface ComponentsLocale {
  locale: ComponentsLocaleCode
  messages: ComponentsI18nMessages
}

export interface ComponentsI18n {
  locale: ComponentsLocaleCode
  t: ComponentsTranslate
}
