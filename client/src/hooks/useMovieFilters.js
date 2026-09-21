import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SORT_OPTIONS } from '../lib/constants';

const SORTS = new Set(SORT_OPTIONS.map((o) => o.value));

/**
 * The URL is the single source of truth for what the user is browsing.
 * That gives us, for free: shareable links, working Back/Forward buttons,
 * state that survives a refresh, and returning from a movie page to the exact same list.
 * Hand-edited/garbage URL values are sanitised here instead of causing 400s.
 */
export function parseFilters(sp) {
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const sort = SORTS.has(sp.get('sort')) ? sp.get('sort') : 'popularity';
  const genres = [...new Set((sp.get('genres') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    .slice(0, 5)
    .sort((a, b) => a - b);
  const yearRaw = sp.get('year');
  const year = /^\d{4}$/.test(yearRaw ?? '') ? Number(yearRaw) : undefined;
  const ratingRaw = Number(sp.get('minRating'));
  const minRating = ratingRaw > 0 && ratingRaw <= 10 ? ratingRaw : undefined;
  const lang = sp.get('language');
  const language = /^[a-z]{2}$/.test(lang ?? '') ? lang : undefined;
  return { q, sort, genres, year, minRating, language };
}

export function useMovieFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  /** Merge a patch into the URL. `replace` so tweaking filters doesn't flood history. */
  const setFilters = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
            if (empty || (k === 'sort' && v === 'popularity')) next.delete(k);
            else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setFilters({ genres: [], year: '', minRating: '', language: '', sort: '' });
  }, [setFilters]);

  const hasActiveFilters = Boolean(filters.genres.length || filters.year || filters.minRating || filters.language);
  const isSearching = filters.q.length > 0;

  return { filters, setFilters, clearFilters, hasActiveFilters, isSearching };
}
