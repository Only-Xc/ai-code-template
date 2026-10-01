import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { PrismaService } from './prisma/prisma.service'
import { StorageService } from './storage/storage.service'

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
    private readonly storage: StorageService,
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
      await this.cache.set('readyz:probe', 1, 5000)
      await this.cache.get('readyz:probe')
      checks.push('redis: ok')
    } catch {
      throw new ServiceUnavailableException('redis unavailable')
    }

    try {
      await this.storage.bucketExists()
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
