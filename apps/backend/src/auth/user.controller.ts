import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import type { User } from 'generated/prisma/client'
import { AuthService, toUserPublic } from './auth.service'
import {
  CreateUserDto,
  RegisterDto,
  UpdateMeDto,
  UpdatePasswordDto,
  UpdateUserDto,
  UserPublic,
  UsersPublic,
} from './auth.dto'
import { JwtAuthGuard, SuperuserGuard } from './auth.guard'
import { CurrentUser } from './current-user.decorator'

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(200)
  signup(@Body() dto: RegisterDto): Promise<UserPublic> {
    return this.authService.registerUser(dto)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): UserPublic {
    return toUserPublic(user)
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateMeDto,
  ): Promise<UserPublic> {
    return this.authService.updateMe(user, dto)
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changeMyPassword(@CurrentUser() user: User, @Body() dto: UpdatePasswordDto) {
    return this.authService.changeMyPassword(user, dto)
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteMe(@CurrentUser() user: User) {
    return this.authService.deleteMe(user)
  }

  @Get()
  @UseGuards(SuperuserGuard)
  list(
    @Query('skip') skip = '0',
    @Query('limit') limit = '20',
  ): Promise<UsersPublic> {
    return this.authService.listUsers(Number(skip), Number(limit))
  }

  @Post()
  @UseGuards(SuperuserGuard)
  @HttpCode(200)
  create(@Body() dto: CreateUserDto): Promise<UserPublic> {
    return this.authService.createUser(dto)
  }

  @Get(':user_id')
  @UseGuards(JwtAuthGuard)
  get(
    @CurrentUser() user: User,
    @Param('user_id', ParseUUIDPipe) id: string,
  ): Promise<UserPublic> {
    return this.authService.getVisibleUser(id, user)
  }

  @Patch(':user_id')
  @UseGuards(SuperuserGuard)
  update(
    @Param('user_id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserPublic> {
    return this.authService.updateUser(id, dto)
  }

  @Delete(':user_id')
  @UseGuards(SuperuserGuard)
  remove(
    @CurrentUser() user: User,
    @Param('user_id', ParseUUIDPipe) id: string,
  ) {
    return this.authService.deleteUser(id, user)
  }
}
