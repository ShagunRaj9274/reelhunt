/** Builds a fake `fetch` that answers from a route table and records calls. */
export function fakeFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    const u = new URL(url);
    calls.push(u);
    for (const [pattern, handler] of Object.entries(routes)) {
      if (u.pathname.endsWith(pattern)) {
        const out = typeof handler === 'function' ? await handler(u, calls.length) : handler;
        if (out instanceof Error) throw out;
        const { status = 200, body = {}, headers = {} } = out;
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json', ...headers },
        });
      }
    }
    return new Response('{}', { status: 404 });
  };
  fn.calls = calls;
  return fn;
}

export const rawMovie = (id, extra = {}) => ({
  id,
  title: `Movie ${id}`,
  overview: 'Overview',
  release_date: '2020-05-01',
  vote_average: 7.345,
  vote_count: 1200,
  popularity: 50,
  poster_path: `/poster${id}.jpg`,
  backdrop_path: `/backdrop${id}.jpg`,
  genre_ids: [28, 12],
  original_language: 'en',
  ...extra,
});

export const page = (results, extra = {}) => ({ page: 1, total_pages: 3, total_results: 60, results, ...extra });

export const silentLogger = { info() {}, warn() {}, error() {} };
