-- ReelHunt database schema (PostgreSQL flavour; the SQLite version in
-- sqliteWishlistRepo.js is identical apart from column types).
--
-- We persist ONLY what belongs to the user: which movies they saved and when.
-- Movie metadata is owned by TMDB; we keep a small snapshot (title, poster,
-- year, rating) so the wishlist renders instantly and still works when TMDB
-- is slow or down. Full details are always fetched live (and cached).

CREATE TABLE IF NOT EXISTS wishlist_items (
  client_id    TEXT        NOT NULL,          -- anonymous per-browser id (UUID)
  movie_id     INTEGER     NOT NULL,          -- TMDB movie id
  title        TEXT        NOT NULL,
  poster_path  TEXT,                          -- e.g. "/abc.jpg" (NOT a full URL: image CDN/sizes can change)
  release_date TEXT,                          -- YYYY-MM-DD
  rating       REAL,
  genre_ids    TEXT        NOT NULL DEFAULT '[]',  -- JSON array, used for client-side filtering
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, movie_id)          -- one row per movie per user => idempotent adds
);

CREATE INDEX IF NOT EXISTS idx_wishlist_client_added
  ON wishlist_items (client_id, added_at DESC);
