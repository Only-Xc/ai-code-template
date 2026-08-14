import dayjs from 'dayjs'

import 'dayjs/locale/ar'
import 'dayjs/locale/zh-cn'

import { localeConfigs } from './constants'
import type { LocaleCode } from './types'

export function syncDayjsLocale(locale: LocaleCode) {
  dayjs.locale(localeConfigs[locale].dayjsLocale)
}
