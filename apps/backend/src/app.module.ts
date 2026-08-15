import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { HealthController, ReadinessController } from './health.controller'
import { ConfigModule } from '@nestjs/config'
import { configuration } from './config'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { CacheModule } from '@nestjs/cache-manager'
import KeyvRedis, { Keyv } from '@keyv/redis'
import { StorageModule } from './storage/storage.module'
import { AuthModule } from './auth/auth.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [configuration],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const redis = configuration('redis')
        const auth = redis.auth ? `:${redis.auth}@` : ''
        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(
                `redis://${auth}${redis.host}:${redis.port}/${redis.db}`,
              ),
            }),
          ],
        }
      },
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
  ],
  controllers: [HealthController, ReadinessController],
  providers: [
    // 全局拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
