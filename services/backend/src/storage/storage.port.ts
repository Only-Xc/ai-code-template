import type { Readable } from 'node:stream'

export const STORAGE_PORT = Symbol('STORAGE_PORT')

export interface StoragePutRequest {
  key: string
  body: Uint8Array | Readable
  contentLength?: number
  contentType?: string
  metadata?: Readonly<Record<string, string>>
}

export interface StorageReadOptions {
  /** 读取上限，默认 1 GiB；超限抛错，防止大对象撑爆内存。 */
  readonly maxBytes?: number
  /** 可选的 SHA-256 校验，不匹配抛错。 */
  readonly expectedSha256?: string
}

export interface StoragePutResult {
  bucket: string
  key: string
  sizeBytes: number | undefined
  contentType: string | undefined
  etag: string | undefined
  metadata: Record<string, string> | undefined
}

export interface StorageObjectMetadata extends StoragePutResult {
  lastModified: Date | undefined
}

export interface StoragePresignedUrl {
  url: string
  expiresSeconds: number
}

/** 负责对象 IO，而将对象授权留给调用方工作流。 */
export interface StoragePort {
  putObject(request: StoragePutRequest): Promise<StoragePutResult>
  getObject(key: string, options?: StorageReadOptions): Promise<Uint8Array>
  deleteObject(key: string): Promise<void>
  headObject(key: string): Promise<StorageObjectMetadata>
  objectExists(key: string): Promise<boolean>
  bucketExists(bucket?: string): Promise<boolean>
  ensureBucket(bucket?: string): Promise<void>
  createPresignedGetUrl(
    key: string,
    expiresSeconds: number,
  ): Promise<StoragePresignedUrl>
}
