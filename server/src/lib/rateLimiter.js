/**
 * Outbound limiter for calls to the third-party API.
 *
 * Combines two limits:
 *   - a token bucket  -> at most `maxPerSecond` requests per second (smooths bursts)
 *   - a concurrency cap -> at most `maxConcurrent` requests in flight at once
 *
 * Callers `await limiter.schedule(fn)`; excess work waits in a FIFO queue
 * instead of hammering the upstream and getting HTTP 429s back.
 * The queue is bounded so a traffic spike can't grow memory forever.
 */
export class RateLimiter {
  constructor({ maxPerSecond = 30, maxConcurrent = 8, maxQueue = 500, now = () => Date.now() } = {}) {
    this.capacity = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillPerMs = maxPerSecond / 1000;
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
    this.now = now;
    this.lastRefill = now();
    this.active = 0;
    this.queue = [];
    this.timer = null;
  }

  schedule(task) {
    if (this.queue.length >= this.maxQueue) {
      const err = new Error('Outbound request queue is full');
      err.code = 'QUEUE_FULL';
      return Promise.reject(err);
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.#drain();
    });
  }

  get pending() {
    return this.queue.length;
  }

  #refill() {
    const t = this.now();
    const elapsed = t - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
      this.lastRefill = t;
    }
  }

  #drain() {
    this.#refill();
    while (this.queue.length && this.active < this.maxConcurrent && this.tokens >= 1) {
      this.tokens -= 1;
      this.active++;
      const { task, resolve, reject } = this.queue.shift();
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          this.active--;
          this.#drain();
        });
    }
    // Out of tokens but work is waiting: wake up when the next token is available.
    if (this.queue.length && this.active < this.maxConcurrent && !this.timer) {
      const waitMs = Math.max(1, Math.ceil((1 - this.tokens) / this.refillPerMs));
      this.timer = setTimeout(() => {
        this.timer = null;
        this.#drain();
      }, waitMs);
    }
  }
}
