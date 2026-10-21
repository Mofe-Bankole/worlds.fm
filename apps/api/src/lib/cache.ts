/**
 * Small in-memory TTL cache with negative-entry support.
 *
 * Negative entries store "known missing" results for a shorter period so that
 * repeated lookups for unavailable media do not hammer upstream providers.
 * Entries expire lazily on read; capacity is bounded with FIFO eviction.
 */

export interface CacheHit<V> {
  hit: true;
  value: V;
  negative: boolean;
}

export type CacheRead<V> = CacheHit<V> | { hit: false };

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  negative: boolean;
}

export interface TtlCacheOptions {
  ttlMs: number;
  negativeTtlMs: number;
  maxEntries: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export class TtlCache<V> {
  private readonly ttlMs: number;
  private readonly negativeTtlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, CacheEntry<V>>();

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.negativeTtlMs = options.negativeTtlMs;
    this.maxEntries = options.maxEntries;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): CacheRead<V> {
    const entry = this.entries.get(key);
    if (!entry) {
      return { hit: false };
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return { hit: false };
    }
    return { hit: true, value: entry.value, negative: entry.negative };
  }

  set(key: string, value: V, options?: { negative?: boolean; ttlMs?: number }): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else {
      this.evictIfNeeded();
    }
    const negative = options?.negative ?? false;
    const ttl = options?.ttlMs ?? (negative ? this.negativeTtlMs : this.ttlMs);
    this.entries.set(key, {
      value,
      negative,
      expiresAt: this.now() + ttl
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private evictIfNeeded(): void {
    if (this.entries.size < this.maxEntries) {
      return;
    }
    const oldest = this.entries.keys().next();
    if (!oldest.done) {
      this.entries.delete(oldest.value);
    }
  }
}
