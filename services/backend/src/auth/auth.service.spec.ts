import { hash as argonHash } from '@node-rs/argon2'
import { AuthService } from './auth.service'
import { ResponseException } from 'src/common/exceptions/response.exception'

describe('AuthService', () => {
  let service: AuthService
  const prisma = { user: { findUnique: jest.fn() } }
  const jwtService = { signAsync: jest.fn() }
  const cache = { set: jest.fn(), get: jest.fn(), del: jest.fn() }

  beforeEach(async () => {
    jest.clearAllMocks()
    jwtService.signAsync.mockResolvedValue('signed-token')
    service = new AuthService(
      prisma as never,
      jwtService as never,
      cache as never,
    )
  })

  describe('login', () => {
    it('成功登录返回令牌对并缓存 refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'a@b.com',
        hashed_password: await argonHash('password123'),
        is_active: true,
        is_superuser: false,
        full_name: null,
        created_at: new Date(),
      })

      const result = await service.login('a@b.com', 'password123')

      expect(result.access_token).toBe('signed-token')
      expect(result.refresh_token).toBeTruthy()
      expect(result.token_type).toBe('bearer')
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:refresh-token:/),
        'user-id',
        expect.any(Number),
      )
    })

    it('密码错误抛 ResponseException', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'a@b.com',
        hashed_password: await argonHash('other-pass-123'),
        is_active: true,
        is_superuser: false,
        full_name: null,
        created_at: new Date(),
      })

      await expect(service.login('a@b.com', 'wrongpass1')).rejects.toThrow(
        ResponseException,
      )
    })

    it('用户不存在抛 ResponseException', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.login('missing@b.com', 'password123'),
      ).rejects.toThrow(ResponseException)
    })

    it('未激活用户抛 ResponseException', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'a@b.com',
        hashed_password: await argonHash('password123'),
        is_active: false,
        is_superuser: false,
        full_name: null,
        created_at: new Date(),
      })

      await expect(service.login('a@b.com', 'password123')).rejects.toThrow(
        ResponseException,
      )
    })
  })
})
