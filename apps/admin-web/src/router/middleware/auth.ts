import { redirect, type MiddlewareFunction } from 'react-router'

import { testAccessToken } from '@/api/auth'
import { mockAccessToken, mockAuthUser } from '@/mock/auth'
import { useAuthStore } from '@/store/useAuth'

export const authMiddleware: MiddlewareFunction = async (_args, next) => {
  const { accessToken, clearAuth, setUserInfo, user } = useAuthStore.getState()

  if (!accessToken) {
    return redirect('/login')
  }

  // demo 数据：mock 登录后跳过真实接口校验，接入真实接口后请删除
  if (accessToken === mockAccessToken) {
    if (!user) {
      setUserInfo(mockAuthUser)
    }

    return next()
  }

  try {
    if (!user) {
      const userInfo = await testAccessToken(accessToken)

      setUserInfo(userInfo)
    }
  } catch {
    clearAuth()

    return redirect('/login')
  }

  return next()
}
