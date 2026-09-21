import { z } from 'zod';

/**
 * All environment configuration is parsed and validated in ONE place.
 * If something is misconfigured the server fails fast with a readable message
 * instead of failing later on the first request.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  TMDB_READ_TOKEN: z.string().optional().default(''),
  TMDB_API_KEY: z.string().optional().default(''),
  TMDB_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
  TMDB_IMAGE_BASE_URL: z.string().url().default('https://image.tmdb.org/t/p'),
  TMDB_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  TMDB_MAX_RPS: z.coerce.number().positive().default(30),
  TMDB_MAX_CONCURRENCY: z.coerce.number().int().positive().default(8),
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(1000),
  DATABASE_URL: z.string().optional().default(''),
  SQLITE_PATH: z.string().default('data/reelhunt.db'),
  CORS_ORIGINS: z.string().optional().default(''),
});

export function loadConfig(env = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const c = parsed.data;
  return {
    env: c.NODE_ENV,
    isProd: c.NODE_ENV === 'production',
    port: c.PORT,
    tmdb: {
      readToken: c.TMDB_READ_TOKEN.trim(),
      apiKey: c.TMDB_API_KEY.trim(),
      baseUrl: c.TMDB_BASE_URL.replace(/\/$/, ''),
      imageBaseUrl: c.TMDB_IMAGE_BASE_URL.replace(/\/$/, ''),
      timeoutMs: c.TMDB_TIMEOUT_MS,
      maxRps: c.TMDB_MAX_RPS,
      maxConcurrency: c.TMDB_MAX_CONCURRENCY,
    },
    cache: { maxEntries: c.CACHE_MAX_ENTRIES },
    db: { url: c.DATABASE_URL.trim(), sqlitePath: c.SQLITE_PATH },
    corsOrigins: c.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
