import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // don't refetch data we got < 5 min ago
      gcTime: 30 * 60 * 1000, // keep it in memory so "Back" is instant
      refetchOnWindowFocus: false,
      // Retry only what might succeed on a second try: never 4xx.
      retry: (failureCount, error) => failureCount < 2 && (error?.retryable ?? false),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
  },
});

/** Central place for query keys, so invalidation can't drift out of sync. */
export const keys = {
  movies: (filters) => ['movies', filters],
  trending: (window) => ['trending', window],
  movie: (id) => ['movie', Number(id)],
  genres: ['genres'],
  wishlist: ['wishlist'],
};
