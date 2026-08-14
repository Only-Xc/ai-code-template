import { createRequest } from './client.js'

export interface AuthUser {
  id: string
  email: string
  full_name?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResult {
  accessToken: string
}

export const loginWithPasswordRequest = (credentials: LoginCredentials) =>
  createRequest<LoginResult, LoginCredentials>('POST', '/auth/login', {
    data: credentials,
  })

export const testAccessTokenRequest = (token: string) =>
  createRequest<AuthUser>('GET', '/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
