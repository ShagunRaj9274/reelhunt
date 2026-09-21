import { badRequest } from '../lib/errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The app has no login, so each browser generates a random UUID once and sends
 * it in the `X-Client-Id` header. The wishlist is scoped to that id.
 * (Swapping this for real auth later only changes this middleware.)
 */
export function requireClientId(req, _res, next) {
  const id = req.get('x-client-id');
  if (!id || !UUID_RE.test(id)) {
    return next(badRequest('Missing or invalid X-Client-Id header'));
  }
  req.clientId = id.toLowerCase();
  next();
}
