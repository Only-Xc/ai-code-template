import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { configuration } from 'src/config'
import { AuthService } from './auth.service'
import { LoginController } from './login.controller'
import { LogoutController } from './logout.controller'
import { UserController } from './user.controller'
import { JwtAuthGuard, SuperuserGuard } from './auth.guard'
import { JwtStrategy } from './jwt.strategy'
import { RateLimitGuard } from './rate-limit.guard'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: configuration('auth.jwtSecret'),
        signOptions: { expiresIn: configuration('auth.accessTokenTtl') },
      }),
    }),
  ],
  controllers: [LoginController, LogoutController, UserController],
  providers: [
    AuthService,
    JwtAuthGuard,
    SuperuserGuard,
    JwtStrategy,
    RateLimitGuard,
  ],
  exports: [AuthService, JwtAuthGuard, SuperuserGuard, RateLimitGuard],
})
export class AuthModule {}
