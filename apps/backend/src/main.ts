import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { HttpExceptionsFilter } from './common/filters/http-exceptions.filter'
import { setupSwagger } from './swagger'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ ignoreTrailingSlash: true }),
  )

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

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0')

  // 打印启动日志
  console.log(`Application is running on: ${await app.getUrl()}`)
}
void bootstrap()
