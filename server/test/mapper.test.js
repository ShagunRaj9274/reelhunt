import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMovieMapper } from '../src/mappers/movieMapper.js';
import { rawMovie } from './helpers.js';

const m = createMovieMapper({ imageBaseUrl: 'https://img.test/t/p' });

test('maps a normal movie', () => {
  const s = m.toSummary(rawMovie(7));
  assert.equal(s.id, 7);
  assert.equal(s.year, 2020);
  assert.equal(s.rating, 7.3);
  assert.equal(s.poster.md, 'https://img.test/t/p/w342/poster7.jpg');
});

test('drops items without id or title and removes duplicates', () => {
  const list = m.toSummaryList([rawMovie(1), { id: 2 }, { title: 'No id' }, null, 'junk', rawMovie(1), rawMovie(3)]);
  assert.deepEqual(list.map((x) => x.id), [1, 3]);
});

test('handles missing / malformed fields without throwing', () => {
  const s = m.toSummary({ id: '42', original_title: '  Fallback  ', release_date: '', vote_average: 'abc', vote_count: null, poster_path: 'no-slash.jpg', genre_ids: 'x' });
  assert.equal(s.id, 42);
  assert.equal(s.title, 'Fallback');
  assert.equal(s.releaseDate, null);
  assert.equal(s.year, null);
  assert.equal(s.rating, null);
  assert.equal(s.poster, null);
  assert.deepEqual(s.genreIds, []);
});

test('a rating with zero votes is treated as unrated', () => {
  assert.equal(m.toSummary(rawMovie(1, { vote_count: 0 })).rating, null);
});

test('page totals are clamped to TMDB limits', () => {
  const p = m.toPage({ page: 1, total_pages: 9000, total_results: 180000, results: [rawMovie(1)] });
  assert.equal(p.totalPages, 500);
  assert.equal(m.toPage(undefined).results.length, 0);
});

test('details pick the best trailer and directors', () => {
  const d = m.toDetails({
    ...rawMovie(5),
    genres: [{ id: 28, name: 'Action' }, { id: null, name: 'Broken' }],
    runtime: 0,
    credits: { cast: [{ id: 2, name: 'B', order: 1 }, { id: 1, name: 'A', order: 0 }, { name: 'no id' }], crew: [{ job: 'Director', name: 'Dir' }, { job: 'Director', name: 'Dir' }] },
    videos: { results: [{ site: 'Vimeo', key: 'v', type: 'Trailer' }, { site: 'YouTube', key: 't', type: 'Teaser' }, { site: 'YouTube', key: 'T', type: 'Trailer', official: true }] },
    recommendations: { results: [rawMovie(5), rawMovie(6)] },
  });
  assert.equal(d.runtime, null);
  assert.deepEqual(d.genres, [{ id: 28, name: 'Action' }]);
  assert.deepEqual(d.cast.map((c) => c.name), ['A', 'B']);
  assert.deepEqual(d.directors, ['Dir']);
  assert.equal(d.trailer.key, 'T');
  assert.deepEqual(d.related.map((r) => r.id), [6], 'the movie itself is not recommended');
});
