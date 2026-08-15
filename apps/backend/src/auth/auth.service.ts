import { createHash, randomUUID } from 'node:crypto'
import { compare as bcryptCompare } from 'bcryptjs'
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { verify as argonVerify, hash as argonHash } from '@node-rs/argon2'
import type { Cache } from 'cache-manager'
import type { User } from 'generated/prisma/client'
import { configuration } from 'src/config'
import { PrismaService } from 'src/prisma/prisma.service'
import { ResponseException } from 'src/common/exceptions/response.exception'
import {
  CreateUserDto,
  RegisterDto,
  TokenResponse,
  UpdateMeDto,
  UpdatePasswordDto,
  UpdateUserDto,
  UserPublic,
  UsersPublic,
} from './auth.dto'

const REFRESH_TOKEN_PREFIX = 'auth:refresh-token:'

// 用户不存在时校验的固定 Argon2 哈希，保持失败响应耗时稳定（防时序枚举）。
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$5TM435hddmJdY8PsPPs2qQ$8ITl5eDaFKQQP8PIRYGboQMWmtaGyftHBdAEYU+sAG4'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async login(email: string, password: string): Promise<TokenResponse> {
    const user = await this.authenticate(email, password)
    if (!user) {
      throw new ResponseException('Incorrect email or password')
    }
    if (!user.is_active) {
      throw new ResponseException('Inactive user')
    }
    return this.issueTokenPair(user)
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const key = this.refreshKey(refreshToken)
    const userId = await this.cache.get<string>(key)
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      await this.cache.del(key)
      throw new UnauthorizedException('Invalid refresh token')
    }
    if (!user.is_active) {
      throw new ResponseException('Inactive user')
    }

    // 旋转：旧 refresh token 一次性使用
    await this.cache.del(key)
    return this.issueTokenPair(user)
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.cache.del(this.refreshKey(refreshToken))
    return { message: 'Logged out successfully' }
  }

  async registerUser(dto: RegisterDto): Promise<UserPublic> {
    await this.ensureEmailAvailable(dto.email)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        hashed_password: await argonHash(dto.password),
        full_name: dto.full_name,
      },
    })
    return toUserPublic(user)
  }

  async createUser(dto: CreateUserDto): Promise<UserPublic> {
    await this.ensureEmailAvailable(dto.email)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        hashed_password: await argonHash(dto.password),
        full_name: dto.full_name,
        is_active: dto.is_active ?? true,
        is_superuser: dto.is_superuser ?? false,
      },
    })
    return toUserPublic(user)
  }

  async updateMe(user: User, dto: UpdateMeDto): Promise<UserPublic> {
    if (dto.email && dto.email !== user.email) {
      await this.ensureEmailAvailable(dto.email)
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: dto.email ?? user.email,
        full_name: dto.full_name ?? user.full_name,
      },
    })
    return toUserPublic(updated)
  }

  async changeMyPassword(
    user: User,
    dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const ok = await argonVerify(user.hashed_password, dto.current_password)
    if (!ok) {
      throw new ResponseException('Incorrect password')
    }
    if (dto.new_password === dto.current_password) {
      throw new ResponseException(
        'New password cannot be the same as the current one',
      )
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashed_password: await argonHash(dto.new_password) },
    })
    return { message: 'Password updated successfully' }
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserPublic> {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException(
        'The user with this id does not exist in the system',
      )
    }
    if (dto.email && dto.email !== existing.email) {
      await this.ensureEmailAvailable(dto.email)
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email ?? existing.email,
        full_name: dto.full_name ?? existing.full_name,
        is_active: dto.is_active ?? existing.is_active,
        is_superuser: dto.is_superuser ?? existing.is_superuser,
        ...(dto.password
          ? { hashed_password: await argonHash(dto.password) }
          : {}),
      },
    })
    return toUserPublic(updated)
  }

  async deleteMe(user: User): Promise<{ message: string }> {
    if (user.is_superuser) {
      throw new ForbiddenException(
        'Super users are not allowed to delete themselves',
      )
    }
    await this.prisma.user.delete({ where: { id: user.id } })
    return { message: 'User deleted successfully' }
  }

  async deleteUser(
    id: string,
    currentUser: User,
  ): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException(
        'The user with this id does not exist in the system',
      )
    }
    if (existing.id === currentUser.id) {
      throw new ForbiddenException(
        'Super users are not allowed to delete themselves',
      )
    }
    await this.prisma.user.delete({ where: { id } })
    return { message: 'User deleted successfully' }
  }

  async listUsers(skip = 0, limit = 20): Promise<UsersPublic> {
    const safeSkip = Math.max(0, Number(skip) || 0)
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
    const [users, count] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        skip: safeSkip,
        take: safeLimit,
      }),
      this.prisma.user.count(),
    ])
    return { data: users.map(toUserPublic), count }
  }

  async getVisibleUser(id: string, currentUser: User): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new NotFoundException(
        'The user with this id does not exist in the system',
      )
    }
    if (user.id !== currentUser.id && !currentUser.is_superuser) {
      throw new ForbiddenException("The user doesn't have enough privileges")
    }
    return toUserPublic(user)
  }

  private async authenticate(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) {
      // 保持与"用户存在但密码错误"相近的耗时，避免通过响应时间枚举邮箱
      await argonVerify(DUMMY_HASH, password).catch(() => undefined)
      return null
    }
    const ok = await this.verifyPassword(password, user.hashed_password)
    // 旧 bcrypt 哈希验证通过后升级为 Argon2 并落库（镜像 fastapi verify_and_update）
    if (ok && isBcryptHash(user.hashed_password)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { hashed_password: await argonHash(password) },
      })
    }
    return ok ? user : null
  }

  private async verifyPassword(
    password: string,
    hashed: string,
  ): Promise<boolean> {
    if (isBcryptHash(hashed)) {
      return bcryptCompare(password, hashed)
    }
    return argonVerify(hashed, password).catch(() => false)
  }

  private async issueTokenPair(user: User): Promise<TokenResponse> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id })
    const refreshToken = randomUUID().replace(/-/g, '')
    const refreshTtlMs = configuration('auth.refreshTokenTtl') * 1000
    await this.cache.set(this.refreshKey(refreshToken), user.id, refreshTtlMs)
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    }
  }

  private refreshKey(refreshToken: string): string {
    const digest = createHash('sha256').update(refreshToken).digest('hex')
    return `${REFRESH_TOKEN_PREFIX}${digest}`
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ResponseException(
        'The user with this email already exists in the system.',
      )
    }
  }
}

export function toUserPublic(user: User): UserPublic {
  return {
    email: user.email,
    is_active: user.is_active,
    is_superuser: user.is_superuser,
    full_name: user.full_name ?? undefined,
    id: user.id,
    created_at: user.created_at,
  }
}

function isBcryptHash(hashed: string): boolean {
  return hashed.startsWith('$2')
}
