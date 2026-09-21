import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { TmdbClient } from '../src/lib/tmdbClient.js';
import { createMovieMapper } from '../src/mappers/movieMapper.js';
import { createMovieService } from '../src/services/movieService.js';
import { createSqliteWishlistRepo } from '../src/db/sqliteWishlistRepo.js';
import { fakeFetch, rawMovie, page, silentLogger } from './helpers.js';

const CLIENT = '6f1c2b0e-7a4d-4c1e-9b2a-3d5e6f7a8b9c';
let app, repo, fetchFn;

before(async () => {
  fetchFn = fakeFetch({
    '/discover/movie': (u) => ({ body: page([rawMovie(1), rawMovie(2, { genre_ids: [35] })], { page: Number(u.searchParams.get('page')) }) }),
    '/search/movie': { body: page([rawMovie(10, { genre_ids: [28], vote_average: 8, vote_count: 500 }), rawMovie(11, { genre_ids: [35], vote_average: 5, vote_count: 500 })]) },
    '/trending/movie/week': { body: page([rawMovie(3)]) },
    '/movie/99': { body: { ...rawMovie(99), genres: [{ id: 28, name: 'Action' }] } },
    '/movie/404': { status: 404 },
    '/movie/500': { status: 500 },
    '/genre/movie/list': { body: { genres: [{ id: 35, name: 'Comedy' }, { id: 28, name: 'Action' }] } },
  });
  const config = loadConfig({ NODE_ENV: 'test', TMDB_READ_TOKEN: 'x' });
  const tmdb = new TmdbClient({ baseUrl: 'https://tmdb.test/3', readToken: 'x', fetchImpl: fetchFn, sleepImpl: async () => {}, logger: silentLogger });
  const mapper = createMovieMapper({ imageBaseUrl: 'https://img.test/t/p' });
  const movieService = createMovieService({ tmdb, mapper, now: () => new Date('2026-01-15') });
  repo = await createSqliteWishlistRepo({ filePath: ':memory:' });
  app = createApp({ config, movieService, wishlistRepo: repo, mapper, tmdb, logger: silentLogger });
});

after(() => repo.close());

test('GET /api/movies discovers with our sort names mapped to TMDB params', async () => {
  const res = await request(app).get('/api/movies?sort=rating&genres=28,12&year=2020&page=2').expect(200);
  assert.equal(res.body.mode, 'discover');
  assert.equal(res.body.page, 2);
  assert.equal(res.body.results.length, 2);
  const u = fetchFn.calls.at(-1);
  assert.equal(u.searchParams.get('sort_by'), 'vote_average.desc');
  assert.equal(u.searchParams.get('vote_count.gte'), '300');
  assert.equal(u.searchParams.get('with_genres'), '28,12');
  assert.equal(u.searchParams.get('primary_release_year'), '2020');
});

test('GET /api/movies?q= searches and applies genre/rating filters', async () => {
  const res = await request(app).get('/api/movies?q=matrix&genres=28&minRating=7').expect(200);
  assert.equal(res.body.mode, 'search');
  assert.equal(res.body.filteredLocally, true);
  assert.deepEqual(res.body.results.map((m) => m.id), [10]);
});

test('invalid query params return 400 with details', async () => {
  const res = await request(app).get('/api/movies?sort=bogus&page=0').expect(400);
  assert.equal(res.body.error.code, 'BAD_REQUEST');
  assert.ok(res.body.error.details.length >= 2);
});

test('movie details, 404 and upstream failure map to clean errors', async () => {
  const ok = await request(app).get('/api/movies/99').expect(200);
  assert.equal(ok.body.movie.title, 'Movie 99');
  const nf = await request(app).get('/api/movies/404').expect(404);
  assert.equal(nf.body.error.code, 'NOT_FOUND');
  const down = await request(app).get('/api/movies/500').expect(503);
  assert.equal(down.body.error.code, 'UPSTREAM_UNAVAILABLE');
  await request(app).get('/api/movies/abc').expect(400);
});

test('genres and trending', async () => {
  const g = await request(app).get('/api/genres').expect(200);
  assert.deepEqual(g.body.genres.map((x) => x.name), ['Action', 'Comedy']);
  const t = await request(app).get('/api/movies/trending').expect(200);
  assert.equal(t.body.results[0].id, 3);
});

test('wishlist requires a valid client id', async () => {
  await request(app).get('/api/wishlist').expect(400);
  await request(app).get('/api/wishlist').set('X-Client-Id', 'nope').expect(400);
});

test('wishlist add is idempotent, list is per-client, delete works', async () => {
  const body = { title: 'Movie 1', posterPath: '/p.jpg', releaseDate: '2020-01-01', rating: 7.1, genreIds: [28] };
  await request(app).put('/api/wishlist/1').set('X-Client-Id', CLIENT).send(body).expect(200);
  const again = await request(app).put('/api/wishlist/1').set('X-Client-Id', CLIENT).send(body).expect(200);
  assert.equal(again.body.item.poster.md, 'https://img.test/t/p/w342/p.jpg');

  const list = await request(app).get('/api/wishlist').set('X-Client-Id', CLIENT).expect(200);
  assert.equal(list.body.count, 1);
  assert.equal(list.headers['cache-control'], 'no-store');

  const other = await request(app).get('/api/wishlist').set('X-Client-Id', '00000000-0000-4000-8000-000000000000').expect(200);
  assert.equal(other.body.count, 0);

  await request(app).delete('/api/wishlist/1').set('X-Client-Id', CLIENT).expect(204);
  await request(app).delete('/api/wishlist/1').set('X-Client-Id', CLIENT).expect(204);
  const empty = await request(app).get('/api/wishlist').set('X-Client-Id', CLIENT).expect(200);
  assert.equal(empty.body.count, 0);
});

test('wishlist rejects invalid bodies', async () => {
  await request(app).put('/api/wishlist/1').set('X-Client-Id', CLIENT).send({ title: '' }).expect(400);
  await request(app).put('/api/wishlist/1').set('X-Client-Id', CLIENT).set('content-type', 'application/json').send('{bad').expect(400);
});

test('health endpoint reports db and upstream status', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.db.status, 'ok');
  assert.equal(res.body.upstream.configured, true);
});

test('unknown api routes return JSON 404', async () => {
  const res = await request(app).get('/api/nope').expect(404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});
