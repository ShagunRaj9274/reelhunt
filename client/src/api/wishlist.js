import { apiFetch } from './client';

/** What we store: a small snapshot so the wishlist renders without calling TMDB. */
export function toSnapshot(movie) {
  return {
    title: movie.title,
    posterPath: movie.poster?.path ?? null,
    releaseDate: movie.releaseDate ?? null,
    rating: movie.rating ?? null,
    genreIds: movie.genreIds ?? [],
  };
}

export const wishlistApi = {
  list: (signal) => apiFetch('/wishlist', { signal }),
  add: (movie) => apiFetch(`/wishlist/${movie.id}`, { method: 'PUT', body: toSnapshot(movie) }),
  remove: (id) => apiFetch(`/wishlist/${id}`, { method: 'DELETE' }),
};
