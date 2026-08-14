import type { AuthUser } from '@ai-app/api'

// demo 数据：接入真实接口后请删除
export const mockCredentials = {
  username: 'admin@example.com',
  password: '123456',
}

// demo 数据：接入真实接口后请删除
export const mockAccessToken = 'mock-access-token'

// demo 数据：接入真实接口后请删除
export const mockAuthUser: AuthUser = {
  id: 'mock-user-1',
  email: mockCredentials.username,
  full_name: 'Mock Admin',
}
