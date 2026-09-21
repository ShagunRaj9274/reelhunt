import { apiFetch, toQueryString } from './client';

export const moviesApi = {
  list: (params, signal) => apiFetch(`/movies${toQueryString(params)}`, { signal }),
  trending: (window = 'week', signal) => apiFetch(`/movies/trending${toQueryString({ window })}`, { signal }),
  details: (id, signal) => apiFetch(`/movies/${id}`, { signal }),
  genres: (signal) => apiFetch('/genres', { signal }),
};
