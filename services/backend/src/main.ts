import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import { configuration } from './config'
import { readTrustedProxyIps } from './config/trusted-proxy'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { HttpExceptionsFilter } from './common/filters/http-exceptions.filter'
import { StructuredLogger } from './common/logging/structured-logger'
import { setupSwagger } from './swagger'

async function bootstrap() {
  const logger = new StructuredLogger('Bootstrap')
  // 只信任配置声明的反向代理对等端；默认不信任任何 x-forwarded-for
  const trustedProxyIps = readTrustedProxyIps(
    configuration('server.trustedProxyIps'),
  )
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: configuration('server.bodyLimitBytes') ?? 40 * 1024 * 1024,
      ignoreTrailingSlash: true,
      trustProxy: trustedProxyIps,
    }),
  )

  // 优雅停机：触发 OnModuleDestroy/OnApplicationShutdown 清理（Prisma/Redis/Storage）
  app.enableShutdownHooks()

  // 接口版本控制：URI 方式（/v1/...）
  app.enableVersioning({
    type: VersioningType.URI,
  })

  // 异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionsFilter())

  // 请求参数校验
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // 设置全局接口前缀
  app.setGlobalPrefix('api')

  // 创建接口文档
  setupSwagger(app)

  await app.listen(
    process.env.PORT ?? configuration('server.port') ?? 3000,
    configuration('server.host') ?? '0.0.0.0',
  )

  // 打印启动日志
  logger.log('backend_started', { url: await app.getUrl() })
}
void bootstrap()
