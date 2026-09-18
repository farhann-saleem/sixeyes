/**
 * Lightweight in-memory TTL query cache for expensive/frequent read queries.
 * Safe for serverless & long-running Node.js instances.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /**
   * Helper that checks cache before computing and caching the expensive query result.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fn();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

export const queryCache = new MemoryCache();
