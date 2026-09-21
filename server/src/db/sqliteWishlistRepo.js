import fs from 'node:fs';
import path from 'node:path';

/**
 * Wishlist repository backed by SQLite (zero-setup local development).
 * `better-sqlite3` is imported lazily so production (Postgres) doesn't need it.
 */
export async function createSqliteWishlistRepo({ filePath }) {
  const { default: Database } = await import('better-sqlite3');
  if (filePath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      client_id    TEXT    NOT NULL,
      movie_id     INTEGER NOT NULL,
      title        TEXT    NOT NULL,
      poster_path  TEXT,
      release_date TEXT,
      rating       REAL,
      genre_ids    TEXT    NOT NULL DEFAULT '[]',
      added_at     TEXT    NOT NULL,
      PRIMARY KEY (client_id, movie_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_client_added ON wishlist_items (client_id, added_at DESC);
  `);

  const stmts = {
    list: db.prepare('SELECT * FROM wishlist_items WHERE client_id = ? ORDER BY added_at DESC, movie_id DESC'),
    count: db.prepare('SELECT COUNT(*) AS n FROM wishlist_items WHERE client_id = ?'),
    get: db.prepare('SELECT * FROM wishlist_items WHERE client_id = ? AND movie_id = ?'),
    upsert: db.prepare(`
      INSERT INTO wishlist_items (client_id, movie_id, title, poster_path, release_date, rating, genre_ids, added_at)
      VALUES (@clientId, @movieId, @title, @posterPath, @releaseDate, @rating, @genreIds, @addedAt)
      ON CONFLICT (client_id, movie_id) DO UPDATE SET
        title = excluded.title, poster_path = excluded.poster_path,
        release_date = excluded.release_date, rating = excluded.rating, genre_ids = excluded.genre_ids
    `),
    remove: db.prepare('DELETE FROM wishlist_items WHERE client_id = ? AND movie_id = ?'),
  };

  return {
    driver: 'sqlite',
    async list(clientId) {
      return stmts.list.all(clientId).map(fromRow);
    },
    async count(clientId) {
      return stmts.count.get(clientId).n;
    },
    async upsert(clientId, item) {
      stmts.upsert.run({
        clientId,
        movieId: item.movieId,
        title: item.title,
        posterPath: item.posterPath,
        releaseDate: item.releaseDate,
        rating: item.rating,
        genreIds: JSON.stringify(item.genreIds ?? []),
        addedAt: new Date().toISOString(),
      });
      return fromRow(stmts.get.get(clientId, item.movieId));
    },
    async remove(clientId, movieId) {
      return stmts.remove.run(clientId, movieId).changes > 0;
    },
    async ping() {
      db.prepare('SELECT 1').get();
    },
    async close() {
      db.close();
    },
  };
}

function fromRow(r) {
  return {
    movieId: r.movie_id,
    title: r.title,
    posterPath: r.poster_path,
    releaseDate: r.release_date,
    rating: r.rating,
    genreIds: safeJsonArray(r.genre_ids),
    addedAt: new Date(r.added_at).toISOString(),
  };
}

export function safeJsonArray(v) {
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}
