import { getClientId } from '../lib/clientId';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** Error type the UI can reason about (status + stable code from the backend). */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** Worth retrying automatically? (server/upstream trouble or network, never 4xx) */
  get retryable() {
    return this.status === 0 || this.status >= 500;
  }
}

/**
 * Thin fetch wrapper. Every request:
 *  - goes to OUR backend (never directly to TMDB)
 *  - carries the anonymous client id (for the wishlist)
 *  - can be cancelled via AbortSignal (React Query passes one), so a stale
 *    search doesn't overwrite a newer one when the user types quickly
 */
export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        'X-Client-Id': getClientId(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. a proxy's HTML error page)
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'HTTP_ERROR',
      data?.error?.message ?? `Request failed (${res.status}). Try again.`,
    );
  }
  return data;
}

export function toQueryString(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
