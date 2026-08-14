import { useMemo } from 'react'
import keyBy from 'lodash-es/keyBy'

import { useDictLocale, useDictStore } from './store.js'
import type { DictItem, DictLocale, DictType } from './types.js'
import { isEmptyDictValue } from './utils.js'

export interface DictOption {
  label: string
  value: string
  disabled?: boolean
}

export interface UseDictOptions {
  locale?: DictLocale
}

export interface UseDictResult {
  items: DictItem[]
  options: DictOption[]
  item: (value: string | number | null | undefined) => DictItem | undefined
  label: (
    value: string | number | null | undefined,
    fallback?: string,
  ) => string
  color: (
    value: string | number | null | undefined,
    fallback?: string,
  ) => string | undefined
}

function getDictItemLabel(item: DictItem, locale?: DictLocale) {
  return (locale ? item.labels?.[locale] : undefined) ?? item.label
}

function toOption(item: DictItem, locale?: DictLocale): DictOption {
  return {
    label: getDictItemLabel(item, locale),
    value: item.value,
    disabled: item.disabled,
  }
}

export function useDict(
  type: DictType,
  options: UseDictOptions = {},
): UseDictResult {
  const items = useDictStore((state) => state.dictMap[type] ?? [])
  const globalLocale = useDictLocale()
  const locale = options.locale ?? globalLocale

  return useMemo(() => {
    const itemMap = keyBy(items, 'value')

    const getItem = (value: string | number | null | undefined) => {
      if (isEmptyDictValue(value)) return undefined

      return itemMap[String(value)]
    }

    return {
      items,
      options: items.map((item) => toOption(item, locale)),
      item: getItem,
      label: (value, fallback) => {
        const item = getItem(value)

        return item
          ? getDictItemLabel(item, locale)
          : (fallback ?? String(value ?? ''))
      },
      color: (value, fallback) => getItem(value)?.color ?? fallback,
    }
  }, [items, locale])
}
