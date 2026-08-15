export interface UploadResult {
  bucket: string
  key: string
  sizeBytes: number | undefined
  contentType: string | undefined
  etag: string | undefined
  metadata: Record<string, string> | undefined
}

export interface ObjectMetadata {
  bucket: string
  key: string
  sizeBytes: number | undefined
  contentType: string | undefined
  etag: string | undefined
  lastModified: Date | undefined
  metadata: Record<string, string> | undefined
}

export interface PresignedUrl {
  url: string
  expiresSeconds: number
}
