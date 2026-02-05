interface CacheItem<T> {
  data: T
  timestamp: number
}

export class Cache<T> {
  private cache = new Map<string, CacheItem<T>>()
  private timeout: number

  constructor(timeout: number = 300000) {
    this.timeout = timeout
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key)
    if (!item) {
      return undefined
    }
    if (Date.now() - item.timestamp > this.timeout) {
      this.cache.delete(key)
      return undefined
    }
    return item.data
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout
  }
}
