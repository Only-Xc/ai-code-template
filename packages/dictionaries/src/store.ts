import { create } from 'zustand'
import mapValues from 'lodash-es/mapValues'

import { dictRegistry } from './registry.js'
import type { DictItem, DictLocale, DictType } from './types.js'

type DictMap = Partial<Record<DictType, DictItem[]>>
const DEFAULT_DICT_LOCALE: DictLocale = 'zh-CN'

interface DictState {
  dictMap: DictMap
  locale: DictLocale
  initLocalDicts: () => void
  registerDict: (type: DictType, items: readonly DictItem[]) => void
  setLocale: (locale: DictLocale) => void
  clearDict: (type?: DictType) => void
}

/**
 * 注册时深拷贝字典项：labels/raw 与之后对源对象的修改彻底脱钩，
 * store 内的字典快照不被外部引用污染。
 */
export function cloneDictItems<Value extends string>(
  items: readonly DictItem<Value>[],
) {
  return items.map((item) => ({
    ...item,
    labels: item.labels ? { ...item.labels } : undefined,
    raw: item.raw ? cloneRecord(item.raw) : undefined,
  }))
}

function cloneRecord(value: Readonly<Record<string, unknown>>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      cloneValue(entryValue),
    ]),
  )
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item))
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return cloneRecord(value as Readonly<Record<string, unknown>>)
  }

  return value
}

function createInitialDictMap(): DictMap {
  return mapValues(dictRegistry, cloneDictItems)
}

export const useDictStore = create<DictState>((set) => ({
  dictMap: createInitialDictMap(),
  locale: DEFAULT_DICT_LOCALE,
  initLocalDicts: () => {
    set({ dictMap: createInitialDictMap() })
  },
  registerDict: (type, items) => {
    set((state) => ({
      dictMap: {
        ...state.dictMap,
        [type]: cloneDictItems(items),
      },
    }))
  },
  setLocale: (locale) => {
    set({ locale })
  },
  clearDict: (type) => {
    if (!type) {
      set({ dictMap: {} })
      return
    }

    set((state) => {
      const next = { ...state.dictMap }
      delete next[type]

      return { dictMap: next }
    })
  },
}))

export function useDictLocale() {
  return useDictStore((state) => state.locale)
}

export function setDictLocale(locale: DictLocale) {
  useDictStore.getState().setLocale(locale)
}
