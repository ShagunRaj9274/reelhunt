import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { moviesRouter } from './routes/movies.js';
import { wishlistRouter } from './routes/wishlist.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

/**
 * Builds the Express app from its dependencies (dependency injection).
 * index.js wires the real ones; tests pass fakes — no network or disk needed.
 */
export function createApp({ config, movieService, wishlistRepo, mapper, tmdb, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway proxy: needed for correct client IPs in rate limiting

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', new URL(config.tmdb?.imageBaseUrl ?? 'https://image.tmdb.org').origin],
          frameSrc: ['https://www.youtube-nocookie.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  if (config.corsOrigins.length) app.use('/api', cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '16kb' }));

  if (config.env !== 'test') {
    app.use('/api', (req, res, next) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        logger.info?.(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
      });
      next();
    });
  }

  // Protect OUR server (and indirectly our TMDB quota) from abusive clients.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.env === 'test' ? 10_000 : 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down and try again in a minute.' } },
    }),
  );

  app.get('/api/health', async (_req, res) => {
    let db = 'ok';
    try {
      await wishlistRepo.ping();
    } catch {
      db = 'down';
    }
    const upstream = tmdb?.health?.() ?? {};
    res.set('Cache-Control', 'no-store');
    res.status(db === 'ok' ? 200 : 503).json({
      status: db === 'ok' ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      db: { driver: wishlistRepo.driver, status: db },
      upstream,
    });
  });

  app.use('/api', moviesRouter({ movieService }));
  app.use('/api', wishlistRouter({ wishlistRepo, mapper }));
  app.use('/api', notFoundHandler);

  // In production the same server also serves the built React app (one deploy, no CORS).
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(
      express.static(CLIENT_DIST, {
        index: false,
        setHeaders(res, filePath) {
          // Vite fingerprints assets, so they can be cached forever; index.html must not be.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(errorHandler(logger));
  return app;
}
