/**
 * TMDB -> our API shape.
 *
 * The client never sees raw TMDB JSON. Everything goes through these functions,
 * which is where we defend against incomplete or unexpected upstream data:
 *   - items without an id or a title are dropped (they can't be rendered or linked)
 *   - wrong types are coerced or replaced with null (never `undefined`, never NaN)
 *   - duplicates are removed (TMDB pages can overlap when popularity shifts)
 *   - image paths become ready-to-use responsive URL sets
 *
 * If we ever switch to a different movie provider, only this file and
 * tmdbClient.js need to change; the frontend contract stays the same.
 */

export const TMDB_MAX_PAGES = 500; // TMDB never returns pages beyond 500

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const cleanString = (v) => (isNonEmptyString(v) ? v.trim() : null);
function toInt(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return null;
}

function toPositiveId(v) {
  const n = toInt(v);
  return n && n > 0 ? n : null;
}

function toDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

function toRating(voteAverage, voteCount) {
  const avg = Number(voteAverage);
  if (!Number.isFinite(avg) || avg <= 0 || avg > 10) return null;
  if (!voteCount) return null; // "7.0 from 0 votes" is meaningless
  return Math.round(avg * 10) / 10;
}

function toImagePath(v) {
  return typeof v === 'string' && v.startsWith('/') ? v : null;
}

export function createMovieMapper({ imageBaseUrl }) {
  const img = (path, size) => `${imageBaseUrl}/${size}${path}`;

  function posterSet(path) {
    const p = toImagePath(path);
    return p ? { path: p, sm: img(p, 'w185'), md: img(p, 'w342'), lg: img(p, 'w500'), xl: img(p, 'w780') } : null;
  }

  function backdropSet(path) {
    const p = toImagePath(path);
    return p ? { path: p, sm: img(p, 'w780'), lg: img(p, 'w1280'), original: img(p, 'original') } : null;
  }

  function profileUrl(path) {
    const p = toImagePath(path);
    return p ? img(p, 'w185') : null;
  }

  /** Compact shape used in lists, grids and the wishlist. */
  function toSummary(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = toPositiveId(raw.id);
    const title = cleanString(raw.title) ?? cleanString(raw.original_title) ?? cleanString(raw.name);
    if (!id || !title) return null;

    const releaseDate = toDate(raw.release_date);
    const voteCount = Math.max(0, toInt(raw.vote_count) ?? 0);
    return {
      id,
      title,
      originalTitle: cleanString(raw.original_title),
      overview: cleanString(raw.overview) ?? '',
      releaseDate,
      year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
      rating: toRating(raw.vote_average, voteCount),
      voteCount,
      popularity: Number.isFinite(Number(raw.popularity)) ? Number(raw.popularity) : 0,
      language: cleanString(raw.original_language),
      genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids.map(toPositiveId).filter(Boolean) : [],
      poster: posterSet(raw.poster_path),
      backdrop: backdropSet(raw.backdrop_path),
    };
  }

  function toSummaryList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      const m = toSummary(raw);
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
    return out;
  }

  /** Paginated list response. */
  function toPage(raw) {
    const results = toSummaryList(raw?.results);
    const page = Math.max(1, toInt(raw?.page) ?? 1);
    const totalPages = Math.min(TMDB_MAX_PAGES, Math.max(0, toInt(raw?.total_pages) ?? 0));
    const totalResults = Math.max(0, toInt(raw?.total_results) ?? results.length);
    return { page, totalPages, totalResults, results };
  }

  function pickTrailer(videos) {
    const list = Array.isArray(videos?.results) ? videos.results : [];
    const youtube = list.filter((v) => v?.site === 'YouTube' && isNonEmptyString(v.key));
    const score = (v) => (v.type === 'Trailer' ? 2 : v.type === 'Teaser' ? 1 : 0) + (v.official ? 0.5 : 0);
    const best = youtube.sort((a, b) => score(b) - score(a))[0];
    if (!best) return null;
    return {
      key: best.key,
      name: cleanString(best.name) ?? 'Trailer',
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(best.key)}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(best.key)}`,
    };
  }

  /** Full shape for the details page. */
  function toDetails(raw) {
    const base = toSummary(raw);
    if (!base) return null;

    const genres = Array.isArray(raw.genres)
      ? raw.genres.map((g) => ({ id: toPositiveId(g?.id), name: cleanString(g?.name) })).filter((g) => g.id && g.name)
      : [];

    const castRaw = Array.isArray(raw.credits?.cast) ? raw.credits.cast : [];
    const cast = castRaw
      .filter((c) => toPositiveId(c?.id) && isNonEmptyString(c?.name))
      .sort((a, b) => (toInt(a.order) ?? 999) - (toInt(b.order) ?? 999))
      .slice(0, 15)
      .map((c) => ({ id: c.id, name: c.name.trim(), character: cleanString(c.character), photo: profileUrl(c.profile_path) }));

    const crewRaw = Array.isArray(raw.credits?.crew) ? raw.credits.crew : [];
    const directors = [...new Set(crewRaw.filter((c) => c?.job === 'Director' && isNonEmptyString(c.name)).map((c) => c.name.trim()))];

    const runtime = toInt(raw.runtime);
    const money = (v) => (toInt(v) > 0 ? toInt(v) : null);

    const recommendations = toSummaryList(raw.recommendations?.results);
    const similar = toSummaryList(raw.similar?.results);

    return {
      ...base,
      genreIds: genres.map((g) => g.id),
      genres,
      tagline: cleanString(raw.tagline),
      runtime: runtime && runtime > 0 ? runtime : null,
      status: cleanString(raw.status),
      budget: money(raw.budget),
      revenue: money(raw.revenue),
      homepage: isNonEmptyString(raw.homepage) && /^https?:\/\//.test(raw.homepage) ? raw.homepage : null,
      imdbId: isNonEmptyString(raw.imdb_id) ? raw.imdb_id : null,
      spokenLanguages: Array.isArray(raw.spoken_languages)
        ? raw.spoken_languages.map((l) => cleanString(l?.english_name) ?? cleanString(l?.name)).filter(Boolean)
        : [],
      countries: Array.isArray(raw.production_countries) ? raw.production_countries.map((c) => cleanString(c?.name)).filter(Boolean) : [],
      directors,
      cast,
      trailer: pickTrailer(raw.videos),
      // Recommendations are usually better; fall back to "similar" when TMDB has none.
      related: (recommendations.length ? recommendations : similar).filter((m) => m.id !== base.id).slice(0, 12),
    };
  }

  function toGenres(raw) {
    const list = Array.isArray(raw?.genres) ? raw.genres : [];
    return list
      .map((g) => ({ id: toPositiveId(g?.id), name: cleanString(g?.name) }))
      .filter((g) => g.id && g.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return { toSummary, toSummaryList, toPage, toDetails, toGenres, posterSet };
}
