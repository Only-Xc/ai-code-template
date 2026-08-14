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

function cloneItems(items: readonly DictItem[]) {
  return items.map((item) => ({ ...item }))
}

function createInitialDictMap(): DictMap {
  return mapValues(dictRegistry, cloneItems)
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
        [type]: cloneItems(items),
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
