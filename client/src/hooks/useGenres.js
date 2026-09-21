import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { moviesApi } from '../api/movies';
import { keys } from '../api/queryClient';

export function useGenres() {
  const query = useQuery({
    queryKey: keys.genres,
    queryFn: ({ signal }) => moviesApi.genres(signal),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const genres = query.data?.genres ?? [];
  const byId = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres]);
  return { ...query, genres, byId };
}
