import { randomUUID } from 'node:crypto'
import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { PrismaService } from './prisma/prisma.service'
import { STORAGE_PORT, type StoragePort } from './storage/storage.port'

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }
}

/** 就绪探针：供容器编排健康检查使用，任一依赖不可用返回 503。 */
@Controller()
export class ReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Get('readyz')
  async readyz() {
    const checks: string[] = []

    try {
      await this.prisma.$queryRaw`SELECT 1`
      checks.push('database: ok')
    } catch {
      throw new ServiceUnavailableException('database unavailable')
    }

    try {
      // 随机 token 写后读回，验证 Redis 真实可用而非仅连接正常
      const token = randomUUID()
      const key = `readyz:probe:${token}`
      await this.cache.set(key, token, 5000)
      if ((await this.cache.get<string>(key)) !== token) {
        throw new Error('redis round-trip mismatch')
      }
      checks.push('redis: ok')
    } catch {
      throw new ServiceUnavailableException('redis unavailable')
    }

    try {
      // bucketExists 返回 false（桶不存在）同样视为未就绪
      if (!(await this.storage.bucketExists())) {
        throw new Error('storage bucket missing')
      }
      checks.push('storage: ok')
    } catch {
      throw new ServiceUnavailableException('storage unavailable')
    }

    return {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    }
  }
}
