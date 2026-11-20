/**
 * Provider Resilience Primitives (Token-Bucket Rate Limiter & Circuit Breaker)
 * Enforces Rule R2: NEVER exceed provider rate limits and degrade honestly to PROVIDER_ERROR.
 */

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillMs: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(rateLimitPerMin: number, nowMs: number = Date.now()) {
    this.capacity = Math.max(1, rateLimitPerMin);
    this.tokens = this.capacity;
    this.refillPerMs = this.capacity / 60_000;
    this.lastRefillMs = nowMs;
  }

  private refill(nowMs: number): void {
    const elapsed = Math.max(0, nowMs - this.lastRefillMs);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefillMs = nowMs;
  }

  tryAcquire(cost = 1, nowMs: number = Date.now()): boolean {
    this.refill(nowMs);
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  availableTokens(nowMs: number = Date.now()): number {
    this.refill(nowMs);
    return Math.floor(this.tokens);
  }
}

export type CircuitState = 'closed' | 'open' | 'half_open';

export class ProviderCircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAtMs = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly resetTimeoutMs = 30_000,
  ) {}

  getState(nowMs: number = Date.now()): CircuitState {
    if (this.state === 'open' && nowMs - this.openedAtMs >= this.resetTimeoutMs) {
      this.state = 'half_open';
    }
    return this.state;
  }

  canExecute(nowMs: number = Date.now()): boolean {
    const current = this.getState(nowMs);
    return current === 'closed' || current === 'half_open';
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  recordFailure(nowMs: number = Date.now()): void {
    this.consecutiveFailures += 1;
    if (this.state === 'half_open' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAtMs = nowMs;
    }
  }
}
