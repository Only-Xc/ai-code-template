import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { User } from 'generated/prisma/client'
import { configuration } from 'src/config'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configuration('auth.jwtSecret'),
    })
  }

  async validate(payload: { sub?: string }): Promise<User> {
    if (!payload.sub) {
      throw new UnauthorizedException('Could not validate credentials')
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })
    if (!user) {
      throw new UnauthorizedException('User not found')
    }
    if (!user.is_active) {
      throw new UnauthorizedException('Inactive user')
    }
    return user
  }
}
