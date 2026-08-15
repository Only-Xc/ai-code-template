import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { User } from 'generated/prisma/client'

/** 从请求中取出 JwtAuthGuard 挂载的当前用户。 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)
