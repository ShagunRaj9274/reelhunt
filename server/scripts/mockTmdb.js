/**
 * Offline mock of the TMDB API (the endpoints ReelHunt uses) + generated SVG posters.
 *
 * Why it exists:
 *   - run & demo the whole app without an API key or internet
 *   - reproduce the awkward real-world cases on purpose: very long titles,
 *     missing posters, odd poster shapes, missing dates/ratings, duplicate
 *     items across pages, slow responses and random failures
 *
 *   node scripts/mockTmdb.js                     # port 4010
 *   MOCK_LATENCY_MS=1500 MOCK_FAILURE_RATE=0.2 node scripts/mockTmdb.js
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const LATENCY = Number(process.env.MOCK_LATENCY_MS ?? 250);
const FAILURE_RATE = Number(process.env.MOCK_FAILURE_RATE ?? 0);
const TOTAL = 6000;

const GENRES = [
  [28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'],
  [18, 'Drama'], [10751, 'Family'], [14, 'Fantasy'], [36, 'History'], [27, 'Horror'], [10402, 'Music'],
  [9648, 'Mystery'], [10749, 'Romance'], [878, 'Science Fiction'], [53, 'Thriller'], [10752, 'War'], [37, 'Western'],
].map(([id, name]) => ({ id, name }));
const LANGS = ['en', 'en', 'en', 'hi', 'ko', 'ja', 'fr', 'es', 'ta', 'te', 'ml'];
const A = ['Silent', 'Crimson', 'Last', 'Hidden', 'Electric', 'Midnight', 'Paper', 'Iron', 'Golden', 'Broken', 'Distant', 'Wild', 'Glass', 'Hollow', 'Northern', 'Burning'];
const B = ['Harbor', 'Signal', 'Kingdom', 'Garden', 'Frontier', 'Protocol', 'Monsoon', 'Orbit', 'Letters', 'Summer', 'Circus', 'Engine', 'River', 'Echo', 'Station', 'Promise'];
const LONG = ' and the Extraordinary, Unbelievable Journey Across the Seven Forgotten Kingdoms of the Northern Sea';
const PEOPLE = ['Aisha Khan', 'Leo Martins', 'Mei Tanaka', 'Arjun Rao', 'Sofia Rossi', 'Noah Becker', 'Priya Nair', 'Jae-won Park', 'Chloé Dubois', 'Diego Alvarez', 'Hana Sato', 'Omar Haddad'];

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function makeMovie(id) {
  const r = rng(id);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  let title = `The ${pick(A)} ${pick(B)}`;
  if (r() < 0.25) title += ` ${Math.floor(r() * 4) + 2}`;
  if (r() < 0.05) title += LONG;
  const year = 1950 + Math.floor(r() * 77);
  const m = String(1 + Math.floor(r() * 12)).padStart(2, '0');
  const d = String(1 + Math.floor(r() * 28)).padStart(2, '0');
  const genreCount = 1 + Math.floor(r() * 3);
  const genre_ids = [...new Set(Array.from({ length: genreCount }, () => pick(GENRES).id))];
  const votes = Math.floor(r() ** 2 * 20000);
  return {
    id,
    title,
    original_title: title,
    overview: r() < 0.08 ? '' : `When a ${pick(A).toLowerCase()} secret surfaces in a small ${pick(B).toLowerCase()} town, two strangers must decide what they are willing to lose. A mock synopsis generated for local testing.`,
    release_date: r() < 0.04 ? '' : `${year}-${m}-${d}`,
    vote_average: votes ? Math.round((3 + r() * 6.8) * 1000) / 1000 : 0,
    vote_count: votes,
    popularity: Math.round(r() ** 3 * 5000 * 100) / 100,
    poster_path: r() < 0.08 ? null : `/p${id}.svg`,
    backdrop_path: r() < 0.15 ? null : `/b${id}.svg`,
    genre_ids,
    original_language: pick(LANGS),
    adult: false,
  };
}

const MOVIES = Array.from({ length: TOTAL }, (_, i) => makeMovie(i + 1));

const SORTERS = {
  'popularity.desc': (a, b) => b.popularity - a.popularity,
  'vote_average.desc': (a, b) => b.vote_average - a.vote_average,
  'primary_release_date.desc': (a, b) => (b.release_date || '').localeCompare(a.release_date || ''),
  'primary_release_date.asc': (a, b) => (a.release_date || '9').localeCompare(b.release_date || '9'),
  'title.asc': (a, b) => a.title.localeCompare(b.title),
  'title.desc': (a, b) => b.title.localeCompare(a.title),
  'revenue.desc': (a, b) => b.vote_count - a.vote_count,
};

function paginate(list, pageParam) {
  const page = Math.max(1, Number(pageParam) || 1);
  const results = list.slice((page - 1) * 20, page * 20);
  // Real-world quirk: rankings shift between requests, so a movie from the
  // previous page sometimes shows up again. The app must dedupe.
  if (page > 1 && results.length && page % 3 === 0) results[0] = list[(page - 1) * 20 - 1];
  return { page, results, total_results: list.length, total_pages: Math.min(500, Math.ceil(list.length / 20)) };
}

function discover(q) {
  const g = (q.get('with_genres') || '').split(',').filter(Boolean).map(Number);
  const year = q.get('primary_release_year');
  const minAvg = Number(q.get('vote_average.gte') || 0);
  const minVotes = Number(q.get('vote_count.gte') || 0);
  const lang = q.get('with_original_language');
  const lte = q.get('primary_release_date.lte');
  let list = MOVIES.filter(
    (m) =>
      g.every((id) => m.genre_ids.includes(id)) &&
      (!year || m.release_date.startsWith(year)) &&
      m.vote_average >= minAvg &&
      m.vote_count >= minVotes &&
      (!lang || m.original_language === lang) &&
      (!lte || (m.release_date && m.release_date <= lte)),
  );
  list = [...list].sort(SORTERS[q.get('sort_by')] ?? SORTERS['popularity.desc']);
  return paginate(list, q.get('page'));
}

function search(q) {
  const term = (q.get('query') || '').toLowerCase();
  const year = q.get('primary_release_year');
  const list = MOVIES.filter((m) => m.title.toLowerCase().includes(term) && (!year || m.release_date.startsWith(year))).sort(SORTERS['popularity.desc']);
  return paginate(list, q.get('page'));
}

function details(id) {
  const m = MOVIES[id - 1];
  if (!m) return null;
  const r = rng(id * 7);
  const related = Array.from({ length: 12 }, () => MOVIES[Math.floor(r() * TOTAL)]);
  return {
    ...m,
    genres: m.genre_ids.map((gid) => GENRES.find((g) => g.id === gid)),
    tagline: r() < 0.6 ? 'Every signal has a source.' : '',
    runtime: r() < 0.1 ? 0 : 80 + Math.floor(r() * 90),
    status: 'Released',
    budget: Math.floor(r() * 200) * 1_000_000,
    revenue: Math.floor(r() * 900) * 1_000_000,
    homepage: '',
    imdb_id: null,
    spoken_languages: [{ english_name: 'English' }],
    production_countries: [{ name: 'India' }, { name: 'United States of America' }],
    credits: {
      cast: PEOPLE.map((name, i) => ({ id: i + 1, name, character: `Character ${i + 1}`, order: i, profile_path: null })),
      crew: [{ job: 'Director', name: PEOPLE[id % PEOPLE.length] }],
    },
    videos: { results: [] },
    recommendations: { results: related },
    similar: { results: [] },
  };
}

function svg(kind, id, size) {
  const m = MOVIES[id - 1];
  const r = rng(id * 13);
  const hue = Math.floor(r() * 360);
  // Deliberately inconsistent shapes: posters are usually 2:3, but not always.
  const shape = kind === 'b' ? [1280, 720] : r() < 0.1 ? [600, 600] : r() < 0.05 ? [800, 450] : [500, 750];
  const [w, h] = shape;
  const title = (m?.title ?? 'Untitled').slice(0, 40).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-size="${size}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},60%,14%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${w * 0.7}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.22}" fill="hsla(${(hue + 180) % 360},80%,70%,.35)"/>
<text x="${w * 0.08}" y="${h * 0.86}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="${Math.min(w, h) * 0.075}" fill="#fff">${title}</text>
</svg>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (status, body, type = 'application/json') => {
    res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': type.includes('svg') ? 'public, max-age=86400' : 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };

  const img = url.pathname.match(/^\/img\/(\w+)\/(p|b)(\d+)\.svg$/);
  if (img) return send(200, svg(img[2], Number(img[3]), img[1]), 'image/svg+xml');

  await new Promise((r) => setTimeout(r, LATENCY * (0.5 + Math.random())));
  if (Math.random() < FAILURE_RATE) return send(503, { status_message: 'Mock outage' });

  const p = url.pathname.replace(/^\/3/, '');
  const q = url.searchParams;
  if (p === '/genre/movie/list') return send(200, { genres: GENRES });
  if (p === '/discover/movie') return send(200, discover(q));
  if (p === '/search/movie') return send(200, search(q));
  if (/^\/trending\/movie\/(day|week)$/.test(p)) {
    const top = [...MOVIES].filter((m) => m.backdrop_path).sort(SORTERS['popularity.desc']).slice(p.endsWith('day') ? 20 : 0, p.endsWith('day') ? 40 : 20);
    return send(200, { page: 1, results: top, total_pages: 1, total_results: 20 });
  }
  const dm = p.match(/^\/movie\/(\d+)$/);
  if (dm) {
    const d = details(Number(dm[1]));
    return d ? send(200, d) : send(404, { status_message: 'The resource you requested could not be found.' });
  }
  send(404, { status_message: 'Unknown mock endpoint' });
});

server.listen(PORT, () => console.log(`🎞️  Mock TMDB on http://localhost:${PORT} (latency ~${LATENCY}ms, failure rate ${FAILURE_RATE})`));
