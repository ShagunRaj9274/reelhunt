import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { moviesApi } from '../api/movies';
import { keys } from '../api/queryClient';

/**
 * Infinite, paginated movie feed for the current filters.
 *
 * - Each filter combination is its own cache entry, so switching back to a
 *   previous combination is instant and costs no request.
 * - React Query passes an AbortSignal: when filters change mid-request, the old
 *   request is cancelled and can never overwrite newer results (no race conditions).
 * - `keepPreviousData` keeps the old grid on screen (dimmed) while the new one
 *   loads, instead of flashing skeletons on every change.
 */
export function useMovieFeed(filters) {
  const searching = Boolean(filters.q);
  // Normalise: options that don't apply to search must not create separate cache entries.
  const params = useMemo(
    () => ({
      q: filters.q || undefined,
      sort: searching ? undefined : filters.sort,
      genres: filters.genres,
      year: filters.year,
      minRating: filters.minRating,
      language: searching ? undefined : filters.language,
    }),
    [filters, searching],
  );

  const query = useInfiniteQuery({
    queryKey: keys.movies(params),
    queryFn: ({ pageParam, signal }) => moviesApi.list({ ...params, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });

  const pages = query.data?.pages;
  const derived = useMemo(() => {
    if (!pages) return { movies: [], totalResults: 0, stale: false, filteredLocally: false, lastPageEmpty: false };
    // Popularity rankings shift between page requests, so the same movie can
    // appear on two pages. Dedupe to avoid duplicate cards (and React key clashes).
    const seen = new Set();
    const movies = [];
    for (const p of pages) {
      for (const m of p.results) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          movies.push(m);
        }
      }
    }
    const recent = pages.slice(-3);
    return {
      movies,
      totalResults: pages[0].totalResults,
      stale: pages.some((p) => p.stale),
      filteredLocally: pages.some((p) => p.filteredLocally),
      // Used to stop auto-loading when locally-filtered search pages keep coming back empty.
      emptyStreak: recent.length === 3 && recent.every((p) => p.results.length === 0),
    };
  }, [pages]);

  return { ...query, ...derived, searching };
}
