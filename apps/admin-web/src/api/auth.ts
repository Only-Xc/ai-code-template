import { loginWithPasswordRequest, testAccessTokenRequest } from '@ai-app/api'

import { request } from './_request'

export type { AuthUser, LoginCredentials, LoginResult } from '@ai-app/api'

export const loginWithPassword = request(loginWithPasswordRequest)
export const testAccessToken = request(testAccessTokenRequest)
