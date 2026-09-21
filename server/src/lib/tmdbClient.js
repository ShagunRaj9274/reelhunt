import { UpstreamError } from './errors.js';
import { TtlCache } from './ttlCache.js';
import { RateLimiter } from './rateLimiter.js';
import { CircuitBreaker } from './circuitBreaker.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Low-level, resilient HTTP client for TMDB. It knows NOTHING about movies —
 * it only knows how to talk to the upstream safely:
 *
 *   request ─► fresh cache? ─► identical request already in flight? ─► circuit open?
 *           ─► rate limiter ─► fetch (timeout) ─► retry w/ backoff on 429/5xx/network
 *           ─► cache result  (or fall back to STALE cache if everything failed)
 *
 * Every method resolves to `{ data, stale }` so the layer above can tell the
 * client when it is looking at slightly outdated data.
 */
export class TmdbClient {
  constructor({
    baseUrl,
    readToken = '',
    apiKey = '',
    timeoutMs = 8000,
    maxRetries = 2,
    maxPerSecond = 30,
    maxConcurrent = 8,
    cacheMaxEntries = 1000,
    fetchImpl = globalThis.fetch,
    sleepImpl = sleep,
    logger = console,
  }) {
    this.baseUrl = baseUrl;
    // People often paste the long v4 token into the v3 key field — detect JWT-shaped keys.
    if (!readToken && apiKey.startsWith('eyJ')) {
      readToken = apiKey;
      apiKey = '';
    }
    this.readToken = readToken;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.fetch = fetchImpl;
    this.sleep = sleepImpl;
    this.logger = logger;

    this.cache = new TtlCache({ maxEntries: cacheMaxEntries });
    this.inflight = new Map();
    this.limiter = new RateLimiter({ maxPerSecond, maxConcurrent });
    this.breaker = new CircuitBreaker();
    this.metrics = { upstreamCalls: 0, dedupedCalls: 0, retries: 0, staleServed: 0 };
  }

  get configured() {
    return Boolean(this.readToken || this.apiKey);
  }

  /**
   * @param {string} path e.g. "/discover/movie"
   * @param {Record<string, string|number|boolean|undefined>} params
   * @param {{ ttlMs: number, staleTtlMs?: number }} cachePolicy
   * @returns {Promise<{ data: any, stale: boolean }>}
   */
  async get(path, params = {}, { ttlMs, staleTtlMs = 24 * 60 * 60 * 1000 }) {
    const key = cacheKey(path, params);

    const hit = this.cache.get(key);
    if (hit) return { data: hit.value, stale: false };

    // Request coalescing: 20 users opening the home page at once => 1 upstream call.
    if (this.inflight.has(key)) {
      this.metrics.dedupedCalls++;
      return this.inflight.get(key);
    }

    const promise = (async () => {
      try {
        const data = await this.#fetchWithPolicy(path, params);
        this.cache.set(key, data, { ttlMs, staleTtlMs });
        return { data, stale: false };
      } catch (err) {
        // Graceful degradation: an old answer is better than no answer.
        const fallbackable = err instanceof UpstreamError && (err.retryable || err.kind === 'CIRCUIT_OPEN');
        if (fallbackable) {
          const stale = this.cache.get(key, { allowStale: true });
          if (stale) {
            this.metrics.staleServed++;
            this.logger.warn?.(`[tmdb] serving stale data for ${path} (${err.kind})`);
            return { data: stale.value, stale: true };
          }
        }
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  async #fetchWithPolicy(path, params) {
    if (!this.configured) {
      throw new UpstreamError('AUTH', 'TMDB credentials are not configured (set TMDB_READ_TOKEN or TMDB_API_KEY)');
    }
    if (!this.breaker.canRequest()) {
      throw new UpstreamError('CIRCUIT_OPEN', 'Upstream temporarily disabled after repeated failures');
    }

    let lastErr;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const data = await this.limiter.schedule(() => this.#fetchOnce(path, params));
        this.breaker.onSuccess();
        return data;
      } catch (err) {
        lastErr = err instanceof UpstreamError ? err : new UpstreamError('NETWORK', err.message);
        if (!lastErr.retryable) {
          // 404 / 401 / malformed JSON are "healthy" responses from a live service.
          if (lastErr.kind === 'NOT_FOUND') this.breaker.onSuccess();
          else if (lastErr.kind === 'BAD_RESPONSE') this.breaker.onFailure();
          throw lastErr;
        }
        if (attempt < this.maxRetries) {
          this.metrics.retries++;
          const backoff = lastErr.retryAfterMs ?? 300 * 2 ** attempt + Math.random() * 200;
          await this.sleep(Math.min(backoff, 5000));
        }
      }
    }
    this.breaker.onFailure();
    throw lastErr;
  }

  async #fetchOnce(path, params) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers = { accept: 'application/json' };
    if (this.readToken) headers.authorization = `Bearer ${this.readToken}`;
    else url.searchParams.set('api_key', this.apiKey);

    this.metrics.upstreamCalls++;
    let res;
    try {
      res = await this.fetch(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new UpstreamError('TIMEOUT', `TMDB did not respond within ${this.timeoutMs}ms`);
      }
      throw new UpstreamError('NETWORK', `Could not reach TMDB: ${err?.message ?? err}`);
    }

    if (res.status === 404) throw new UpstreamError('NOT_FOUND', 'Resource not found', 404);
    if (res.status === 401 || res.status === 403) throw new UpstreamError('AUTH', 'TMDB rejected our credentials', res.status);
    if (res.status === 429) {
      const e = new UpstreamError('RATE_LIMITED', 'TMDB rate limit hit', 429);
      const retryAfter = Number(res.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) e.retryAfterMs = retryAfter * 1000;
      throw e;
    }
    if (res.status >= 500) throw new UpstreamError('UNAVAILABLE', `TMDB returned ${res.status}`, res.status);
    if (!res.ok) throw new UpstreamError('BAD_RESPONSE', `TMDB returned ${res.status}`, res.status);

    try {
      return await res.json();
    } catch {
      throw new UpstreamError('BAD_RESPONSE', 'TMDB returned invalid JSON');
    }
  }

  health() {
    return {
      configured: this.configured,
      circuit: this.breaker.state,
      cacheEntries: this.cache.size,
      cacheStats: this.cache.stats,
      queued: this.limiter.pending,
      ...this.metrics,
    };
  }
}

/** Stable key: same params in a different order must hit the same cache entry. */
export function cacheKey(path, params) {
  const qs = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}
