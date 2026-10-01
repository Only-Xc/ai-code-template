import { Module, type DynamicModule, type Provider } from '@nestjs/common'
import { configuration } from 'src/config'
import { LocalStorageAdapter } from './local-storage.adapter'
import { STORAGE_PORT } from './storage.port'
import { StorageService } from './storage.service'

/**
 * 按 storage.backend 选择对象存储实现：
 * - s3（默认）：MinIO / S3 兼容
 * - local：本地文件系统（免 MinIO，不支持 presigned URL）
 *
 * 通过 STORAGE_PORT 注入，消费方不感知具体实现。
 */
@Module({})
export class StorageModule {
  static register(): DynamicModule {
    const backend = configuration('storage.backend') ?? 's3'
    const implementation: Provider =
      backend === 'local' ? LocalStorageAdapter : StorageService
    return {
      module: StorageModule,
      providers: [
        implementation,
        { provide: STORAGE_PORT, useExisting: implementation },
      ],
      exports: [STORAGE_PORT],
    }
  }
}
