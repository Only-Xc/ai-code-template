import { ApiProperty } from '@nestjs/swagger'
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

/** OAuth2 密码表单（application/x-www-form-urlencoded，username 即邮箱）。 */
export class LoginFormDto {
  @ApiProperty({ description: '邮箱' })
  @IsString()
  @MinLength(1)
  username!: string

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(1)
  password!: string
}

export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString()
  @MinLength(1)
  refresh_token!: string
}

export class RegisterDto {
  @ApiProperty({ description: '邮箱' })
  @IsEmail()
  email!: string

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  full_name?: string
}

export class CreateUserDto {
  @ApiProperty({ description: '邮箱' })
  @IsEmail()
  email!: string

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  full_name?: string

  @ApiProperty({ description: '是否激活', required: false })
  @IsOptional()
  is_active?: boolean

  @ApiProperty({ description: '是否超管', required: false })
  @IsOptional()
  is_superuser?: boolean
}

export class UpdateUserDto {
  @ApiProperty({ description: '邮箱', required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ description: '密码', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  full_name?: string

  @ApiProperty({ description: '是否激活', required: false })
  @IsOptional()
  is_active?: boolean

  @ApiProperty({ description: '是否超管', required: false })
  @IsOptional()
  is_superuser?: boolean
}

export class UpdateMeDto {
  @ApiProperty({ description: '邮箱', required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  full_name?: string
}

export class UpdatePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  current_password!: string

  @ApiProperty({ description: '新密码' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  new_password!: string
}

export class TokenResponse {
  @ApiProperty({ description: '访问令牌' })
  access_token!: string

  @ApiProperty({ description: '刷新令牌' })
  refresh_token!: string

  @ApiProperty({ description: '令牌类型', default: 'bearer' })
  token_type = 'bearer'
}

export class UserPublic {
  @ApiProperty({ description: '邮箱' })
  email!: string

  @ApiProperty({ description: '是否激活' })
  is_active!: boolean

  @ApiProperty({ description: '是否超管' })
  is_superuser!: boolean

  @ApiProperty({ description: '姓名', required: false })
  full_name?: string

  @ApiProperty({ description: '用户 ID' })
  id!: string

  @ApiProperty({ description: '创建时间' })
  created_at!: Date
}

export class UsersPublic {
  @ApiProperty({ type: [UserPublic] })
  data!: UserPublic[]

  @ApiProperty({ description: '总数' })
  count!: number
}
