import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { User } from 'generated/prisma/client'

export interface AuthenticatedRequest {
  user?: User
  headers: { authorization?: string }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class SuperuserGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean
    if (!ok) {
      return false
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user?.is_superuser) {
      throw new ForbiddenException("The user doesn't have enough privileges")
    }
    return true
  }
}
