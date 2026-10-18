// High performance in-memory & session storage cache
// Designed to sustain ~500 concurrent visitor peaks without overwhelming RTDB listeners

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  /**
   * Get cached data if fresh
   */
  get<T>(key: string): T | null {
    const now = Date.now();

    // Check memory cache first
    const entry = this.memoryCache.get(key);
    if (entry && now - entry.timestamp < entry.ttl) {
      this.stats.hits++;
      return entry.data as T;
    }

    // Check sessionStorage fallback
    try {
      const raw = sessionStorage.getItem(`cn_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (now - parsed.timestamp < parsed.ttl) {
          // Warm up memory cache
          this.memoryCache.set(key, parsed as CacheEntry<unknown>);
          this.stats.hits++;
          return parsed.data;
        } else {
          sessionStorage.removeItem(`cn_cache_${key}`);
        }
      }
    } catch {
      // Ignore sessionStorage errors (e.g. storage disabled or full)
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store data in cache with TTL (default 120 seconds)
   */
  set<T>(key: string, data: T, ttlMs = 120_000): void {
    const now = Date.now();
    const entry: CacheEntry<T> = { data, timestamp: now, ttl: ttlMs };

    this.memoryCache.set(key, entry as CacheEntry<unknown>);
    this.stats.sets++;

    try {
      sessionStorage.setItem(`cn_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Ignore quota exceeded errors
    }
  }

  /**
   * Invalidate a specific key or all keys matching a prefix
   */
  invalidate(keyOrPrefix: string): void {
    for (const key of this.memoryCache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.memoryCache.delete(key);
      }
    }

    try {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey && (storageKey === `cn_cache_${keyOrPrefix}` || storageKey.startsWith(`cn_cache_${keyOrPrefix}`))) {
          toRemove.push(storageKey);
        }
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  /**
   * Clear all cached items
   */
  clearAll(): void {
    this.memoryCache.clear();
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('cn_cache_')) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  getStats() {
    return {
      ...this.stats,
      cachedEntriesCount: this.memoryCache.size,
    };
  }
}

export const cacheService = new CacheService();
