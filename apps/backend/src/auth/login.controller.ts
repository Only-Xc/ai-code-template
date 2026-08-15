import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import type { User } from 'generated/prisma/client'
import { AuthService, toUserPublic } from './auth.service'
import {
  LoginFormDto,
  RefreshTokenDto,
  TokenResponse,
  UserPublic,
} from './auth.dto'
import { JwtAuthGuard } from './auth.guard'
import { RateLimitGuard } from './rate-limit.guard'
import { CurrentUser } from './current-user.decorator'

@Controller({ path: 'login', version: '1' })
export class LoginController {
  constructor(private readonly authService: AuthService) {}

  @Post('access-token')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  login(@Body() dto: LoginFormDto): Promise<TokenResponse> {
    return this.authService.login(dto.username, dto.password)
  }

  @Post('refresh-token')
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponse> {
    return this.authService.refresh(dto.refresh_token)
  }

  @Post('test-token')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  testToken(@CurrentUser() user: User): UserPublic {
    return toUserPublic(user)
  }
}
