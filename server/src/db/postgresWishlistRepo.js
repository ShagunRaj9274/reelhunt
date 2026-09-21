import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { safeJsonArray } from './sqliteWishlistRepo.js';

/**
 * Wishlist repository backed by PostgreSQL (production: Neon / Render / Supabase).
 * Same interface as the SQLite repo, so the rest of the app doesn't care which one runs.
 */
export async function createPostgresWishlistRepo({ connectionString }) {
  const { default: pg } = await import('pg');
  const needsSsl = !/localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  const schema = fs.readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
  await pool.query(schema); // idempotent (IF NOT EXISTS)

  return {
    driver: 'postgres',
    async list(clientId) {
      const { rows } = await pool.query(
        'SELECT * FROM wishlist_items WHERE client_id = $1 ORDER BY added_at DESC, movie_id DESC',
        [clientId],
      );
      return rows.map(fromRow);
    },
    async count(clientId) {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM wishlist_items WHERE client_id = $1', [clientId]);
      return rows[0].n;
    },
    async upsert(clientId, item) {
      const { rows } = await pool.query(
        `INSERT INTO wishlist_items (client_id, movie_id, title, poster_path, release_date, rating, genre_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (client_id, movie_id) DO UPDATE SET
           title = EXCLUDED.title, poster_path = EXCLUDED.poster_path,
           release_date = EXCLUDED.release_date, rating = EXCLUDED.rating, genre_ids = EXCLUDED.genre_ids
         RETURNING *`,
        [clientId, item.movieId, item.title, item.posterPath, item.releaseDate, item.rating, JSON.stringify(item.genreIds ?? [])],
      );
      return fromRow(rows[0]);
    },
    async remove(clientId, movieId) {
      const { rowCount } = await pool.query('DELETE FROM wishlist_items WHERE client_id = $1 AND movie_id = $2', [clientId, movieId]);
      return rowCount > 0;
    },
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
  };
}

function fromRow(r) {
  return {
    movieId: r.movie_id,
    title: r.title,
    posterPath: r.poster_path,
    releaseDate: r.release_date,
    rating: r.rating === null ? null : Number(r.rating),
    genreIds: safeJsonArray(r.genre_ids),
    addedAt: new Date(r.added_at).toISOString(),
  };
}
