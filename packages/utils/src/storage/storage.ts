import type { StorageApi, StorageSetOptions } from './types.js'

interface StorageValue<T> {
  expiresAt?: number
  value: T
}

function getExpiresAt(options?: StorageSetOptions) {
  if (options?.expiresIn === undefined) {
    return undefined
  }

  if (!Number.isFinite(options.expiresIn)) {
    throw new RangeError('storage expiresIn must be a finite number')
  }

  return Date.now() + options.expiresIn
}

function createStorageApi(storage: Storage): StorageApi {
  return {
    clear() {
      storage.clear()
    },
    get<T>(key: string) {
      const item = storage.getItem(key)

      if (item === null) {
        return undefined
      }

      const data = JSON.parse(item) as StorageValue<T>

      if (data.expiresAt !== undefined && Date.now() >= data.expiresAt) {
        storage.removeItem(key)
        return undefined
      }

      return data.value
    },
    remove(key: string) {
      storage.removeItem(key)
    },
    set<T>(key: string, value: T, options?: StorageSetOptions) {
      storage.setItem(
        key,
        JSON.stringify({
          expiresAt: getExpiresAt(options),
          value,
        }),
      )
    },
  }
}

export const session = createStorageApi(window.sessionStorage)
export const local = createStorageApi(window.localStorage)
