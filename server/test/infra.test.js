import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/lib/ttlCache.js';
import { RateLimiter } from '../src/lib/rateLimiter.js';

test('TtlCache evicts least recently used entries', () => {
  const c = new TtlCache({ maxEntries: 2 });
  c.set('a', 1, { ttlMs: 1000 });
  c.set('b', 2, { ttlMs: 1000 });
  c.get('a'); // a is now most recent
  c.set('c', 3, { ttlMs: 1000 });
  assert.equal(c.get('b'), undefined);
  assert.equal(c.get('a').value, 1);
});

test('TtlCache distinguishes fresh, stale and expired', () => {
  let now = 0;
  const c = new TtlCache({ now: () => now });
  c.set('k', 'v', { ttlMs: 10, staleTtlMs: 10 });
  assert.equal(c.get('k').fresh, true);
  now = 15;
  assert.equal(c.get('k'), undefined);
  assert.equal(c.get('k', { allowStale: true }).fresh, false);
  now = 25;
  assert.equal(c.get('k', { allowStale: true }), undefined);
});

test('RateLimiter never exceeds the concurrency cap', async () => {
  const rl = new RateLimiter({ maxPerSecond: 1000, maxConcurrent: 3 });
  let active = 0;
  let peak = 0;
  const task = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
  };
  await Promise.all(Array.from({ length: 20 }, () => rl.schedule(task)));
  assert.ok(peak <= 3, `peak concurrency was ${peak}`);
});

test('RateLimiter spaces requests to the per-second budget', async () => {
  const rl = new RateLimiter({ maxPerSecond: 20, maxConcurrent: 50 });
  const start = Date.now();
  await Promise.all(Array.from({ length: 30 }, () => rl.schedule(async () => {})));
  // 20 tokens immediately, the other 10 need ~500ms of refill
  assert.ok(Date.now() - start >= 400, `took only ${Date.now() - start}ms`);
});
