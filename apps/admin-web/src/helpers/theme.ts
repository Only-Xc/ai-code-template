import { local } from '@ai-app/utils'

export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ai-admin-theme-mode'

export function getStoredThemeMode() {
  return local.get<ThemeMode>(THEME_STORAGE_KEY)
}

export function setStoredThemeMode(theme: ThemeMode) {
  local.set(THEME_STORAGE_KEY, theme)
}

export function getInitialTheme(): ThemeMode {
  const cacheThemeMode = getStoredThemeMode()

  if (cacheThemeMode) {
    return cacheThemeMode
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}
