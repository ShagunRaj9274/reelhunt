/**
 * In-memory LRU cache with two lifetimes per entry:
 *
 *   fresh  (ttl)        -> served directly, no upstream call
 *   stale  (staleTtl)   -> NOT served normally, but kept so we can fall back
 *                          to it when the upstream service fails
 *   expired             -> evicted
 *
 * A Map preserves insertion order, so re-inserting on read gives us LRU
 * eviction for free: the first key in the Map is the least recently used.
 */
export class TtlCache {
  constructor({ maxEntries = 1000, now = () => Date.now() } = {}) {
    this.maxEntries = maxEntries;
    this.now = now;
    this.map = new Map();
    this.stats = { hits: 0, misses: 0, staleHits: 0, evictions: 0 };
  }

  /**
   * @returns {{ value: any, fresh: boolean } | undefined}
   */
  get(key, { allowStale = false } = {}) {
    const entry = this.map.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    const t = this.now();
    if (t > entry.staleUntil) {
      this.map.delete(key);
      this.stats.misses++;
      return undefined;
    }
    const fresh = t <= entry.freshUntil;
    if (!fresh && !allowStale) {
      this.stats.misses++;
      return undefined;
    }
    // LRU bump
    this.map.delete(key);
    this.map.set(key, entry);
    if (fresh) this.stats.hits++;
    else this.stats.staleHits++;
    return { value: entry.value, fresh };
  }

  set(key, value, { ttlMs, staleTtlMs = 0 }) {
    const t = this.now();
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, freshUntil: t + ttlMs, staleUntil: t + ttlMs + staleTtlMs });
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}
