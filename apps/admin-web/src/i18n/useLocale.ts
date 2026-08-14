import { useAppStore } from '@/store/useApp'
import { localeConfigs, localeOptions } from './constants'

export function useLocale() {
  const locale = useAppStore((state) => state.locale)
  const setLocale = useAppStore((state) => state.setLocale)
  const localeConfig = localeConfigs[locale]

  return {
    locale,
    direction: localeConfig.direction,
    antdLocale: localeConfig.antdLocale,
    setLocale,
    localeOptions,
  }
}
