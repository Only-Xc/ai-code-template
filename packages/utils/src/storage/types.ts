export interface StorageSetOptions {
  /** Time to live in milliseconds. */
  expiresIn?: number
}

export interface StorageApi {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, options?: StorageSetOptions): void
  remove(key: string): void
  clear(): void
}
