import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireClientId } from '../middleware/clientId.js';
import { AppError } from '../lib/errors.js';

export const MAX_WISHLIST_ITEMS = 1000;

const MovieIdParams = z.object({ movieId: z.coerce.number().int().positive().max(2_147_483_647) });

/**
 * Snapshot the client sends when saving a movie. It's the user's own list, so
 * trusting it is acceptable, but it is still strictly validated and bounded.
 */
const WishlistBody = z.object({
  title: z.string().trim().min(1).max(300),
  posterPath: z.string().regex(/^\/[\w.-]+$/).max(200).nullable().optional().default(null),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().default(null),
  rating: z.number().min(0).max(10).nullable().optional().default(null),
  genreIds: z.array(z.number().int().positive()).max(20).optional().default([]),
});

export function wishlistRouter({ wishlistRepo, mapper }) {
  const r = Router();
  r.use('/wishlist', requireClientId);
  r.use('/wishlist', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); // personal data: never cache
    next();
  });

  /** Row -> same shape as a movie summary, so the UI can reuse MovieCard. */
  const toDto = (item) => ({
    id: item.movieId,
    title: item.title,
    releaseDate: item.releaseDate,
    year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
    rating: item.rating,
    genreIds: item.genreIds,
    poster: mapper.posterSet(item.posterPath),
    addedAt: item.addedAt,
  });

  r.get('/wishlist', async (req, res, next) => {
    try {
      const items = await wishlistRepo.list(req.clientId);
      res.json({ items: items.map(toDto), count: items.length });
    } catch (err) {
      next(err);
    }
  });

  // PUT (not POST): adding the same movie twice is idempotent — no duplicates, no error.
  r.put('/wishlist/:movieId', validate(MovieIdParams, 'params'), validate(WishlistBody, 'body'), async (req, res, next) => {
    try {
      const { movieId } = req.valid.params;
      if ((await wishlistRepo.count(req.clientId)) >= MAX_WISHLIST_ITEMS) {
        throw new AppError(409, 'WISHLIST_FULL', `Your wishlist can hold up to ${MAX_WISHLIST_ITEMS} movies.`);
      }
      const saved = await wishlistRepo.upsert(req.clientId, { movieId, ...req.valid.body });
      res.json({ item: toDto(saved) });
    } catch (err) {
      next(err);
    }
  });

  r.delete('/wishlist/:movieId', validate(MovieIdParams, 'params'), async (req, res, next) => {
    try {
      await wishlistRepo.remove(req.clientId, req.valid.params.movieId);
      res.status(204).end(); // idempotent: removing something already gone is still success
    } catch (err) {
      next(err);
    }
  });

  return r;
}
