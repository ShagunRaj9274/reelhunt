/**
 * Picks the storage driver from configuration:
 *   DATABASE_URL set  -> PostgreSQL (production)
 *   otherwise         -> SQLite file (local dev, zero setup)
 */
export async function createWishlistRepo(dbConfig, logger = console) {
  if (dbConfig.url) {
    const { createPostgresWishlistRepo } = await import('./postgresWishlistRepo.js');
    const repo = await createPostgresWishlistRepo({ connectionString: dbConfig.url });
    logger.info?.('[db] using PostgreSQL');
    return repo;
  }
  const { createSqliteWishlistRepo } = await import('./sqliteWishlistRepo.js');
  const repo = await createSqliteWishlistRepo({ filePath: dbConfig.sqlitePath });
  logger.info?.(`[db] using SQLite at ${dbConfig.sqlitePath}`);
  return repo;
}
