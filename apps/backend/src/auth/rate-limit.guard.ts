import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { configuration } from 'src/config'

interface RateLimitRequest {
  url?: string
  ip?: string
  headers?: { 'x-forwarded-for'?: string | string[] }
}

/** 基于缓存计数器的限流（镜像 fastapi：key=ratelimit:{path}:{client_ip}，超限 429）。 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RateLimitRequest>()
    const limit = configuration('auth.rateLimitRequests') ?? 5
    const windowMs = (configuration('auth.rateLimitWindowSeconds') ?? 60) * 1000
    const path = (request.url ?? '').split('?')[0]
    const key = `ratelimit:${path}:${this.clientIp(request)}`

    const current = (await this.cache.get<number>(key)) ?? 0
    if (current >= limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)
    }
    await this.cache.set(key, current + 1, windowMs)
    return true
  }

  private clientIp(request: RateLimitRequest): string {
    const forwarded = request.headers?.['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim()
    }
    return request.ip ?? 'unknown'
  }
}
