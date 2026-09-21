import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { SORT_KEYS } from '../services/movieService.js';
import { TMDB_MAX_PAGES } from '../mappers/movieMapper.js';

const maxYear = () => new Date().getFullYear() + 5;

export const MoviesQuery = z.object({
  q: z.string().trim().max(100).optional().transform((v) => (v ? v : undefined)),
  page: z.coerce.number().int().min(1).max(TMDB_MAX_PAGES).default(1),
  sort: z.enum(SORT_KEYS).default('popularity'),
  genres: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => Number(s.trim())) : []))
    .pipe(z.array(z.number().int().positive()).max(5)),
  year: z.coerce.number().int().min(1874).refine((y) => y <= maxYear(), 'Year is too far in the future').optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  language: z.string().regex(/^[a-z]{2}$/, 'Use a 2-letter ISO 639-1 code').optional(),
});

const TrendingQuery = z.object({ window: z.enum(['day', 'week']).default('week') });
const IdParams = z.object({ id: z.coerce.number().int().positive().max(2_147_483_647) });

/** Short browser/CDN caching on top of our server cache. Stale data is never cached downstream. */
function cacheHeaders(res, seconds, stale) {
  if (stale) {
    res.set('Cache-Control', 'no-store');
    res.set('X-Data-Stale', 'true');
  } else {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
  }
}

export function moviesRouter({ movieService }) {
  const r = Router();

  /**
   * GET /api/movies
   * One endpoint for the main feed: with `q` it searches, without it discovers.
   * The client doesn't need to know TMDB uses two different endpoints for this.
   */
  r.get('/movies', validate(MoviesQuery), async (req, res, next) => {
    try {
      const { q, ...filters } = req.valid.query;
      const data = q
        ? await movieService.search({ q, page: filters.page, year: filters.year, genres: filters.genres, minRating: filters.minRating })
        : await movieService.discover(filters);
      cacheHeaders(res, 60, data.stale);
      res.json({ ...data, mode: q ? 'search' : 'discover' });
    } catch (err) {
      next(err);
    }
  });

  r.get('/movies/trending', validate(TrendingQuery), async (req, res, next) => {
    try {
      const data = await movieService.trending(req.valid.query.window);
      cacheHeaders(res, 300, data.stale);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  r.get('/movies/:id', validate(IdParams, 'params'), async (req, res, next) => {
    try {
      const data = await movieService.details(req.valid.params.id);
      cacheHeaders(res, 600, data.stale);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  r.get('/genres', async (_req, res, next) => {
    try {
      const data = await movieService.genres();
      cacheHeaders(res, 3600, data.stale);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
