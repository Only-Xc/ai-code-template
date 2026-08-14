import type { ReactNode } from 'react'
import isNil from 'lodash-es/isNil'

import type { DictFallback, DictValue } from './components/types.js'

export function isEmptyDictValue(value: string | number | null | undefined) {
  return isNil(value) || value === ''
}

export function renderFallback(
  fallback: DictFallback | undefined,
  value: DictValue,
) {
  if (typeof fallback === 'function') return fallback(value)
  if (fallback !== undefined) return fallback

  return String(value ?? '')
}

export function renderEmpty(emptyText: ReactNode | undefined) {
  return emptyText ?? '-'
}
