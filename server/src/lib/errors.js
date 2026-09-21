/**
 * A single error type for everything the API deliberately returns to clients.
 * `code` is a stable machine-readable string the frontend can switch on;
 * `message` is safe to show to users.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);

/** Errors caused by the third-party movie service. */
export class UpstreamError extends Error {
  /**
   * @param {string} kind  TIMEOUT | NETWORK | RATE_LIMITED | UNAVAILABLE | BAD_RESPONSE | NOT_FOUND | AUTH | CIRCUIT_OPEN
   * @param {string} message
   * @param {number} [upstreamStatus]
   */
  constructor(kind, message, upstreamStatus) {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind;
    this.upstreamStatus = upstreamStatus;
  }

  /** Whether trying again might succeed. */
  get retryable() {
    return ['TIMEOUT', 'NETWORK', 'RATE_LIMITED', 'UNAVAILABLE'].includes(this.kind);
  }
}

/** Maps any error to what OUR API should tell the client (never leaks upstream internals). */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof UpstreamError) {
    switch (err.kind) {
      case 'NOT_FOUND':
        return new AppError(404, 'NOT_FOUND', 'That movie could not be found.');
      case 'TIMEOUT':
        return new AppError(504, 'UPSTREAM_TIMEOUT', 'The movie service is responding slowly. Try again in a moment.');
      case 'RATE_LIMITED':
        return new AppError(503, 'UPSTREAM_RATE_LIMITED', 'The movie service is busy right now. Try again in a few seconds.');
      case 'AUTH':
        return new AppError(502, 'UPSTREAM_AUTH', 'The server is missing valid movie service credentials.');
      case 'CIRCUIT_OPEN':
      case 'UNAVAILABLE':
      case 'NETWORK':
        return new AppError(503, 'UPSTREAM_UNAVAILABLE', 'The movie service is temporarily unavailable. Try again shortly.');
      default:
        return new AppError(502, 'UPSTREAM_BAD_RESPONSE', 'The movie service returned an unexpected response.');
    }
  }
  return new AppError(500, 'INTERNAL', 'Something went wrong on our side.');
}
