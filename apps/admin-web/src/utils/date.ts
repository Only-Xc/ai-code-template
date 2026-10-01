import dayjs, { type ConfigType } from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(localizedFormat)

const DISPLAY_DATE_FORMAT = 'L LTS'
const NAMED_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

export function formatDateTime(value: ConfigType, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback

  const date = dayjs(value)
  return date.isValid() ? date.format(DISPLAY_DATE_FORMAT) : String(value)
}

export function formatDateTimeShort(value: ConfigType, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback

  const date = dayjs(value)
  return date.isValid() ? date.format('MM-DD HH:mm') : String(value)
}

export function formatDateTimeForName(value: ConfigType = dayjs()): string {
  const date = dayjs(value)
  return date.isValid() ? date.format(NAMED_DATE_FORMAT) : String(value)
}

export function dateTimestamp(value: ConfigType): number {
  if (value === null || value === undefined || value === '') return Number.NaN

  return dayjs(value).valueOf()
}

export function nowTimestamp(): number {
  return dayjs().valueOf()
}

export function compareDateAsc(left: ConfigType, right: ConfigType): number {
  return (dateTimestamp(left) || 0) - (dateTimestamp(right) || 0)
}

export function compareDateDesc(left: ConfigType, right: ConfigType): number {
  return (dateTimestamp(right) || 0) - (dateTimestamp(left) || 0)
}
