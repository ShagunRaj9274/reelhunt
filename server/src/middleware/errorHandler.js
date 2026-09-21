import { toAppError } from '../lib/errors.js';

/** Every error leaves the API in the same shape: { error: { code, message, details? } } */
export function errorHandler(logger = console) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    // Malformed JSON body from express.json()
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON' } });
    }
    const appErr = toAppError(err);
    if (appErr.status >= 500) {
      logger.error?.(`[${req.method} ${req.originalUrl}] ${err?.name}: ${err?.message}`);
    }
    if (appErr.status === 503) res.set('Retry-After', '5');
    res.status(appErr.status).json({
      error: { code: appErr.code, message: appErr.message, ...(appErr.details ? { details: appErr.details } : {}) },
    });
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}
