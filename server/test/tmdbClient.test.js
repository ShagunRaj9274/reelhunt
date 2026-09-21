import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TmdbClient, cacheKey } from '../src/lib/tmdbClient.js';
import { fakeFetch, silentLogger } from './helpers.js';

const make = (fetchImpl, opts = {}) =>
  new TmdbClient({
    baseUrl: 'https://tmdb.test/3',
    readToken: 'token',
    fetchImpl,
    sleepImpl: async () => {},
    logger: silentLogger,
    ...opts,
  });

test('cacheKey is independent of param order and ignores empty values', () => {
  assert.equal(cacheKey('/x', { b: 2, a: 1, c: undefined, d: '' }), cacheKey('/x', { a: 1, b: 2 }));
});

test('repeated requests are served from cache', async () => {
  const f = fakeFetch({ '/genre/movie/list': { body: { genres: [] } } });
  const c = make(f);
  await c.get('/genre/movie/list', {}, { ttlMs: 60_000 });
  await c.get('/genre/movie/list', {}, { ttlMs: 60_000 });
  assert.equal(f.calls.length, 1);
});

test('concurrent identical requests are coalesced into one upstream call', async () => {
  const f = fakeFetch({ '/trending/movie/week': async () => { await new Promise((r) => setTimeout(r, 20)); return { body: { results: [] } }; } });
  const c = make(f);
  await Promise.all(Array.from({ length: 10 }, () => c.get('/trending/movie/week', {}, { ttlMs: 60_000 })));
  assert.equal(f.calls.length, 1);
  assert.equal(c.metrics.dedupedCalls, 9);
});

test('retries on 5xx then succeeds', async () => {
  const f = fakeFetch({ '/x': (_u, n) => (n < 3 ? { status: 503 } : { body: { ok: true } }) });
  const c = make(f);
  const { data } = await c.get('/x', {}, { ttlMs: 1000 });
  assert.deepEqual(data, { ok: true });
  assert.equal(f.calls.length, 3);
});

test('does not retry 404 and maps it to NOT_FOUND', async () => {
  const f = fakeFetch({ '/movie/1': { status: 404 } });
  const c = make(f);
  await assert.rejects(c.get('/movie/1', {}, { ttlMs: 1000 }), (e) => e.kind === 'NOT_FOUND');
  assert.equal(f.calls.length, 1);
});

test('respects Retry-After on 429', async () => {
  const waits = [];
  const f = fakeFetch({ '/x': (_u, n) => (n === 1 ? { status: 429, headers: { 'retry-after': '2' } } : { body: { ok: 1 } }) });
  const c = make(f, { sleepImpl: async (ms) => waits.push(ms) });
  await c.get('/x', {}, { ttlMs: 1000 });
  assert.deepEqual(waits, [2000]);
});

test('serves stale cache when upstream fails after the entry expired', async () => {
  let fail = false;
  const f = fakeFetch({ '/x': () => (fail ? { status: 500 } : { body: { v: 1 } }) });
  const c = make(f);
  await c.get('/x', {}, { ttlMs: 1, staleTtlMs: 60_000 });
  await new Promise((r) => setTimeout(r, 5));
  fail = true;
  const res = await c.get('/x', {}, { ttlMs: 1, staleTtlMs: 60_000 });
  assert.equal(res.stale, true);
  assert.deepEqual(res.data, { v: 1 });
});

test('network errors and invalid JSON become typed errors', async () => {
  const c1 = make(fakeFetch({ '/x': new TypeError('fetch failed') }), { maxRetries: 0 });
  await assert.rejects(c1.get('/x', {}, { ttlMs: 1 }), (e) => e.kind === 'NETWORK');
  const c2 = make(fakeFetch({ '/x': { body: 'not json{' } }));
  await assert.rejects(c2.get('/x', {}, { ttlMs: 1 }), (e) => e.kind === 'BAD_RESPONSE');
});

test('circuit opens after repeated failures and fails fast', async () => {
  const f = fakeFetch({ '/x': { status: 500 } });
  const c = make(f, { maxRetries: 0 });
  for (let i = 0; i < 5; i++) {
    await assert.rejects(c.get(`/x`, { i }, { ttlMs: 1 }));
  }
  const before = f.calls.length;
  await assert.rejects(c.get('/x', { i: 99 }, { ttlMs: 1 }), (e) => e.kind === 'CIRCUIT_OPEN');
  assert.equal(f.calls.length, before, 'no upstream call while circuit is open');
});

test('missing credentials fail with AUTH without calling upstream', async () => {
  const f = fakeFetch({});
  const c = make(f, { readToken: '', apiKey: '' });
  await assert.rejects(c.get('/x', {}, { ttlMs: 1 }), (e) => e.kind === 'AUTH');
  assert.equal(f.calls.length, 0);
});

test('a v4 token pasted as API key is sent as a bearer token', async () => {
  let auth;
  const f = async (url, init) => { auth = init.headers.authorization; return new Response('{}', { status: 200 }); };
  const c = make(f, { readToken: '', apiKey: 'eyJhbGciOi.fake' });
  await c.get('/x', {}, { ttlMs: 1 });
  assert.equal(auth, 'Bearer eyJhbGciOi.fake');
});
