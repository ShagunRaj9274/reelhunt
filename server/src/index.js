import 'dotenv/config';
import { loadConfig } from './config.js';
import { TmdbClient } from './lib/tmdbClient.js';
import { createMovieMapper } from './mappers/movieMapper.js';
import { createMovieService } from './services/movieService.js';
import { createWishlistRepo } from './db/index.js';
import { createApp } from './app.js';

async function main() {
  if (process.argv.includes('--mock')) {
    // Offline demo mode: talk to scripts/mockTmdb.js instead of the real TMDB.
    process.env.TMDB_BASE_URL = 'http://localhost:4010/3';
    process.env.TMDB_IMAGE_BASE_URL = 'http://localhost:4010/img';
    process.env.TMDB_READ_TOKEN ||= 'mock-token';
    process.env.TMDB_API_KEY = '';
    process.env.SQLITE_PATH ||= 'data/reelhunt-mock.db';
    console.info('🧪 Mock mode: using the local mock TMDB on :4010');
  }
  const config = loadConfig();
  const logger = console;

  const tmdb = new TmdbClient({
    baseUrl: config.tmdb.baseUrl,
    readToken: config.tmdb.readToken,
    apiKey: config.tmdb.apiKey,
    timeoutMs: config.tmdb.timeoutMs,
    maxPerSecond: config.tmdb.maxRps,
    maxConcurrent: config.tmdb.maxConcurrency,
    cacheMaxEntries: config.cache.maxEntries,
    logger,
  });
  if (!tmdb.configured) {
    logger.warn('⚠️  No TMDB credentials found. Set TMDB_READ_TOKEN (or TMDB_API_KEY) in server/.env — movie endpoints will fail until you do.');
  }

  const mapper = createMovieMapper({ imageBaseUrl: config.tmdb.imageBaseUrl });
  const movieService = createMovieService({ tmdb, mapper });
  const wishlistRepo = await createWishlistRepo(config.db, logger);

  const app = createApp({ config, movieService, wishlistRepo, mapper, tmdb, logger });
  const server = app.listen(config.port, () => {
    logger.info(`🎬 ReelHunt API listening on http://localhost:${config.port}`);
  });

  // Graceful shutdown: finish in-flight requests, then close the DB.
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await wishlistRepo.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
