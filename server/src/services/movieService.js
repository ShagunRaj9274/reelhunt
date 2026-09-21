import { UpstreamError } from '../lib/errors.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Cache lifetimes: how quickly each kind of data realistically changes. */
export const TTL = {
  list: { ttlMs: 10 * MINUTE },
  trending: { ttlMs: 30 * MINUTE },
  details: { ttlMs: 6 * HOUR },
  genres: { ttlMs: 24 * HOUR, staleTtlMs: 7 * 24 * HOUR },
};

/**
 * Our public sort options -> TMDB parameters.
 * Exposing our own names (instead of raw `sort_by` strings) keeps the API stable
 * and lets us add guard rails, e.g. "highest rated" ignores films with 3 votes.
 */
export const SORTS = {
  popularity: () => ({ sort_by: 'popularity.desc' }),
  rating: () => ({ sort_by: 'vote_average.desc', 'vote_count.gte': 300 }),
  newest: (today) => ({ sort_by: 'primary_release_date.desc', 'primary_release_date.lte': today, 'vote_count.gte': 10 }),
  oldest: () => ({ sort_by: 'primary_release_date.asc', 'vote_count.gte': 50 }),
  title_asc: () => ({ sort_by: 'title.asc', 'vote_count.gte': 100 }),
  title_desc: () => ({ sort_by: 'title.desc', 'vote_count.gte': 100 }),
  revenue: () => ({ sort_by: 'revenue.desc' }),
};

export const SORT_KEYS = Object.keys(SORTS);

/**
 * Business logic for movies. Routes call this; this calls the TMDB client and
 * the mapper. Nothing in here knows about HTTP requests/responses.
 */
export function createMovieService({ tmdb, mapper, now = () => new Date() }) {
  const today = () => now().toISOString().slice(0, 10);

  async function discover({ page = 1, sort = 'popularity', genres = [], year, minRating, language }) {
    const params = {
      page,
      include_adult: false,
      include_video: false,
      ...(SORTS[sort] ?? SORTS.popularity)(today()),
      with_genres: genres.length ? genres.join(',') : undefined,
      primary_release_year: year,
      with_original_language: language,
    };
    if (minRating) {
      params['vote_average.gte'] = minRating;
      params['vote_count.gte'] = Math.max(params['vote_count.gte'] ?? 0, 50);
    }
    const { data, stale } = await tmdb.get('/discover/movie', params, TTL.list);
    return { ...mapper.toPage(data), stale };
  }

  /**
   * TMDB's search endpoint only supports a text query + year. Genre and rating
   * filters are applied here, per page, so the UI can offer the same filters in
   * both modes. Trade-off: a filtered page may contain fewer than 20 items; the
   * client keeps loading pages to compensate (see useMovieFeed).
   */
  async function search({ q, page = 1, year, genres = [], minRating }) {
    const { data, stale } = await tmdb.get(
      '/search/movie',
      { query: q, page, include_adult: false, primary_release_year: year },
      TTL.list,
    );
    const result = mapper.toPage(data);
    const filtering = genres.length > 0 || Boolean(minRating);
    if (filtering) {
      result.results = result.results.filter(
        (m) => genres.every((g) => m.genreIds.includes(g)) && (!minRating || (m.rating ?? 0) >= minRating),
      );
    }
    return { ...result, stale, filteredLocally: filtering };
  }

  async function trending(window = 'week') {
    const { data, stale } = await tmdb.get(`/trending/movie/${window}`, {}, TTL.trending);
    return { ...mapper.toPage(data), stale };
  }

  async function details(id) {
    const { data, stale } = await tmdb.get(
      `/movie/${id}`,
      { append_to_response: 'credits,videos,recommendations,similar' },
      TTL.details,
    );
    const movie = mapper.toDetails(data);
    if (!movie) throw new UpstreamError('BAD_RESPONSE', `Movie ${id} payload was missing required fields`);
    return { movie, stale };
  }

  async function genres() {
    const { data, stale } = await tmdb.get('/genre/movie/list', {}, TTL.genres);
    return { genres: mapper.toGenres(data), stale };
  }

  return { discover, search, trending, details, genres };
}
