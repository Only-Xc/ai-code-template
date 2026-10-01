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
import { ObjectMetadata, PresignedUrl, UploadResult } from './storage.types'

const MAX_PRESIGNED_URL_EXPIRES_SECONDS = 7 * 24 * 3600

interface PutObjectInput {
  key: string
  body: Buffer | Uint8Array
  contentType?: string
  metadata?: Record<string, string>
}

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
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

  async putObject(input: PutObjectInput): Promise<UploadResult> {
    const { key, body, contentType, metadata } = input
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
      sizeBytes: body.byteLength,
      contentType,
      etag: result.ETag,
      metadata,
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    if (!result.Body) {
      throw new Error(`object body is empty: ${key}`)
    }
    return Buffer.from(await result.Body.transformToByteArray())
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async headObject(key: string): Promise<ObjectMetadata> {
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    return {
      bucket: this.bucket,
      key,
      sizeBytes: result.ContentLength,
      contentType: result.ContentType,
      etag: result.ETag,
      lastModified: result.LastModified,
      metadata: result.Metadata,
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
  ): Promise<PresignedUrl> {
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
