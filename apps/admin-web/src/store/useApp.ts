import { create } from 'zustand'

import { local } from '@ai-app/utils'
import {
  setStoredThemeMode,
  getInitialTheme,
  type ThemeMode,
} from '@/helpers/theme'
import { changeLocale } from '@/i18n'
import { LOCALE_STORAGE_KEY } from '@/i18n/constants'
import { getInitialLocale, getSafeLocale } from '@/i18n/helper'
import type { LocaleCode } from '@/i18n/types'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'ai-admin-sidebar-collapsed'

interface AppState {
  theme: ThemeMode
  locale: LocaleCode
  sidebarCollapsed: boolean
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setLocale: (locale: LocaleCode) => Promise<void>
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
}

function getNextTheme(theme: ThemeMode): ThemeMode {
  return theme === 'dark' ? 'light' : 'dark'
}

function getInitialSidebarCollapsed() {
  return local.get<boolean>(SIDEBAR_COLLAPSED_STORAGE_KEY) ?? false
}

function setStoredSidebarCollapsed(collapsed: boolean) {
  local.set(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed)
}

export const useAppStore = create<AppState>((set, get) => {
  return {
    theme: getInitialTheme(),
    locale: getInitialLocale(),
    sidebarCollapsed: getInitialSidebarCollapsed(),
    setTheme: (theme) => {
      setStoredThemeMode(theme)
      set({ theme })
    },
    toggleTheme: () => {
      get().setTheme(getNextTheme(get().theme))
    },
    setLocale: async (locale) => {
      const nextLocale = getSafeLocale(locale)

      if (nextLocale === get().locale) return

      await changeLocale(nextLocale)
      local.set(LOCALE_STORAGE_KEY, nextLocale)
      set({ locale: nextLocale })
    },
    setSidebarCollapsed: (sidebarCollapsed) => {
      setStoredSidebarCollapsed(sidebarCollapsed)
      set({ sidebarCollapsed })
    },
    toggleSidebarCollapsed: () => {
      get().setSidebarCollapsed(!get().sidebarCollapsed)
    },
  }
})
