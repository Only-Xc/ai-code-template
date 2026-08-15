import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { RefreshTokenDto } from './auth.dto'

@Controller({ path: 'logout', version: '1' })
export class LogoutController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @HttpCode(200)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refresh_token)
  }
}
