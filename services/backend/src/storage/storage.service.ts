import { createHash } from 'node:crypto'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { configuration } from 'src/config'
import type {
  StorageObjectMetadata,
  StoragePort,
  StoragePresignedUrl,
  StoragePutRequest,
  StoragePutResult,
  StorageReadOptions,
} from './storage.port'

const MAX_PRESIGNED_URL_EXPIRES_SECONDS = 7 * 24 * 3600
const DEFAULT_MAX_READ_BYTES = 1024 * 1024 * 1024

@Injectable()
export class StorageService
  implements StoragePort, OnModuleInit, OnModuleDestroy
{
  private readonly client: S3Client
  private readonly bucket: string
  private readonly autoCreateBucket: boolean

  constructor() {
    const storage = configuration('storage')
    this.bucket = storage.bucket
    this.autoCreateBucket = storage.autoCreateBucket
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
    })
  }

  async onModuleInit() {
    if (this.autoCreateBucket) {
      await this.ensureBucket(this.bucket)
    }
  }

  async onModuleDestroy() {
    this.client.destroy()
  }

  async putObject(request: StoragePutRequest): Promise<StoragePutResult> {
    const { key, body, contentType, metadata } = request
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      }),
    )
    return {
      bucket: this.bucket,
      key,
      sizeBytes: body instanceof Uint8Array ? body.byteLength : undefined,
      contentType,
      etag: result.ETag,
      metadata: metadata ? { ...metadata } : undefined,
    }
  }

  async getObject(
    key: string,
    options: StorageReadOptions = {},
  ): Promise<Uint8Array> {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_READ_BYTES
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    if (!result.Body) {
      throw new Error(`object body is empty: ${key}`)
    }
    if (result.ContentLength !== undefined && result.ContentLength > maxBytes) {
      throw new Error(`object exceeded ${maxBytes} bytes: ${key}`)
    }

    const data = Buffer.from(await result.Body.transformToByteArray())
    if (data.byteLength > maxBytes) {
      throw new Error(`object exceeded ${maxBytes} bytes: ${key}`)
    }
    const expectedSha256 = options.expectedSha256
    if (
      expectedSha256 !== undefined &&
      (!/^[a-f0-9]{64}$/iu.test(expectedSha256) ||
        expectedSha256.toLowerCase() !==
          createHash('sha256').update(data).digest('hex'))
    ) {
      throw new Error(`object digest did not match: ${key}`)
    }
    return data
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async headObject(key: string): Promise<StorageObjectMetadata> {
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    return {
      bucket: this.bucket,
      key,
      sizeBytes: result.ContentLength,
      contentType: result.ContentType,
      etag: result.ETag,
      metadata: result.Metadata,
      lastModified: result.LastModified,
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.headObject(key)
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  async bucketExists(bucket = this.bucket): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }))
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  async ensureBucket(bucket = this.bucket): Promise<void> {
    if (await this.bucketExists(bucket)) {
      return
    }
    await this.client.send(new CreateBucketCommand({ Bucket: bucket }))
  }

  async createPresignedGetUrl(
    key: string,
    expiresSeconds: number,
  ): Promise<StoragePresignedUrl> {
    if (expiresSeconds > MAX_PRESIGNED_URL_EXPIRES_SECONDS) {
      throw new Error(
        `presigned url 有效期不能超过 7 天（${MAX_PRESIGNED_URL_EXPIRES_SECONDS}s）`,
      )
    }
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresSeconds },
    )
    return { url, expiresSeconds }
  }
}

function isNotFoundError(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound'
}
