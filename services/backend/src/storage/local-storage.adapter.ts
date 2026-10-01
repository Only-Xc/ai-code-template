import { Injectable, OnModuleInit } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  promises as fs,
} from 'node:fs'
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { configuration } from 'src/config'
import type {
  StorageObjectMetadata,
  StoragePort,
  StoragePresignedUrl,
  StoragePutRequest,
  StoragePutResult,
  StorageReadOptions,
} from './storage.port'

/** 本地文件系统存储：免 MinIO 的轻量后端，适合本地开发与测试。不支持 presigned URL。 */
@Injectable()
export class LocalStorageAdapter implements StoragePort, OnModuleInit {
  private readonly root: string
  private readonly autoCreateBucket: boolean

  constructor() {
    const storage = configuration('storage')
    this.root = resolve(storage.localDirectory ?? '.data/storage')
    this.autoCreateBucket = storage.autoCreateBucket ?? false
  }

  async onModuleInit() {
    if (this.autoCreateBucket) {
      await this.ensureBucket()
    }
  }

  async putObject(request: StoragePutRequest): Promise<StoragePutResult> {
    const destination = this.resolveKey(request.key)
    const temporary = `${destination}.tmp-${randomUUID()}`
    await fs.mkdir(dirname(destination), { recursive: true })

    let sizeBytes = 0
    const digest = createHash('sha256')
    try {
      if (request.body instanceof Uint8Array) {
        sizeBytes = request.body.byteLength
        digest.update(request.body)
        await fs.writeFile(temporary, request.body, { flag: 'wx', mode: 0o600 })
      } else {
        const meter = new Transform({
          transform(chunk: Buffer | Uint8Array | string, _encoding, callback) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            sizeBytes += bytes.byteLength
            digest.update(bytes)
            callback(null, bytes)
          },
        })
        await pipeline(
          request.body,
          meter,
          createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
        )
      }

      if (
        request.contentLength !== undefined &&
        request.contentLength !== sizeBytes
      ) {
        throw new Error(
          'Object content length does not match the uploaded stream',
        )
      }
      await fs.rename(temporary, destination)
    } catch (cause) {
      await fs.rm(temporary, { force: true }).catch(() => undefined)
      throw new Error(`Local object storage write failed: ${request.key}`, {
        cause,
      })
    }

    return {
      bucket: 'local',
      key: request.key,
      sizeBytes,
      contentType: request.contentType,
      etag: digest.digest('hex'),
      metadata: request.metadata ? { ...request.metadata } : undefined,
    }
  }

  async getObject(
    key: string,
    options: StorageReadOptions = {},
  ): Promise<Uint8Array> {
    const path = this.resolveKey(key)
    const metadata = await fs.stat(path)
    const maxBytes = options.maxBytes ?? 1024 * 1024 * 1024
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new Error(`Local object unavailable or exceeded ${maxBytes} bytes`)
    }

    const chunks: Buffer[] = []
    const hash = createHash('sha256')
    let totalBytes = 0
    for await (const chunk of createReadStream(path)) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += bytes.byteLength
      if (totalBytes > maxBytes) {
        throw new Error(`Local object exceeded ${maxBytes} bytes`)
      }
      hash.update(bytes)
      chunks.push(bytes)
    }
    const expectedSha256 = options.expectedSha256
    if (
      expectedSha256 !== undefined &&
      (!/^[a-f0-9]{64}$/iu.test(expectedSha256) ||
        expectedSha256.toLowerCase() !== hash.digest('hex'))
    ) {
      throw new Error(`Local object digest did not match: ${key}`)
    }
    return Buffer.concat(chunks, totalBytes)
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true })
  }

  async headObject(key: string): Promise<StorageObjectMetadata> {
    const path = this.resolveKey(key)
    const stat = await fs.stat(path)
    if (!stat.isFile()) {
      throw new Error(`Local object is not a file: ${key}`)
    }
    return {
      bucket: 'local',
      key,
      sizeBytes: stat.size,
      contentType: undefined,
      etag: undefined,
      metadata: undefined,
      lastModified: stat.mtime,
    }
  }

  async objectExists(key: string): Promise<boolean> {
    return existsSync(this.resolveKey(key))
  }

  async bucketExists(): Promise<boolean> {
    return existsSync(this.root)
  }

  async ensureBucket(): Promise<void> {
    mkdirSync(this.root, { recursive: true })
  }

  async createPresignedGetUrl(
    _key: string,
    _expiresSeconds: number,
  ): Promise<StoragePresignedUrl> {
    throw new Error('LocalStorageAdapter does not support presigned URLs')
  }

  /** 按 key 打开只读流（不进内存），供文件下载等场景使用。 */
  createReadStream(key: string): Readable {
    return createReadStream(this.resolveKey(key))
  }

  /** 解析 key 到 root 内的绝对路径，拒绝目录逃逸。 */
  private resolveKey(key: string): string {
    const path = normalize(resolve(this.root, key))
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`Storage key escapes the local root: ${key}`)
    }
    if (isAbsolute(key) || key.includes('\0')) {
      throw new Error(`Invalid storage key: ${key}`)
    }
    return path
  }
}
