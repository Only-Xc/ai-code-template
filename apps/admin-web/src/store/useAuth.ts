import { create } from 'zustand'

import type { AuthUser } from '@ai-app/api'
import { local } from '@ai-app/utils'

export const AUTH_TOKEN_STORAGE_KEY = 'ai-admin-access-token'

interface AuthState {
  accessToken: string
  user: AuthUser | null
  setToken: (accessToken: string) => void
  setUserInfo: (user: AuthUser | null) => void
  clearAuth: () => void
}

function getInitialAccessToken() {
  return local.get<string>(AUTH_TOKEN_STORAGE_KEY) ?? ''
}

export const useAuthStore = create<AuthState>((set) => {
  const accessToken = getInitialAccessToken()

  return {
    accessToken,
    user: null,
    setToken: (nextAccessToken) => {
      local.set(AUTH_TOKEN_STORAGE_KEY, nextAccessToken)
      set({
        accessToken: nextAccessToken,
      })
    },
    setUserInfo: (user) => {
      set({ user })
    },
    clearAuth: () => {
      local.remove(AUTH_TOKEN_STORAGE_KEY)
      set({
        accessToken: '',
        user: null,
      })
    },
  }
})
