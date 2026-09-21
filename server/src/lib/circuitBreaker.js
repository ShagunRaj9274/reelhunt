/**
 * Minimal circuit breaker.
 *
 * CLOSED    -> requests flow normally; consecutive failures are counted
 * OPEN      -> after `failureThreshold` failures in a row we stop calling the
 *              upstream for `cooldownMs` and fail fast (callers can serve stale cache)
 * HALF_OPEN -> after the cooldown one trial request is let through;
 *              success closes the circuit, failure re-opens it
 *
 * Why: when TMDB is down, waiting 8s for every request to time out makes the
 * whole app feel broken. Failing fast lets us immediately show cached data or
 * a clear error instead.
 */
export class CircuitBreaker {
  constructor({ failureThreshold = 5, cooldownMs = 20_000, now = () => Date.now() } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
    this.state = 'CLOSED';
    this.failures = 0;
    this.openedAt = 0;
    this.trialInFlight = false;
  }

  /** @returns {boolean} whether a request may be attempted now */
  canRequest() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && this.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
    }
    if (this.state === 'HALF_OPEN' && !this.trialInFlight) {
      this.trialInFlight = true;
      return true;
    }
    return false;
  }

  onSuccess() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.trialInFlight = false;
  }

  onFailure() {
    this.trialInFlight = false;
    this.failures++;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this.now();
    }
  }
}
