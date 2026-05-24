'use strict';

class CircuitBreaker {
  constructor({ failureThreshold = 3, cooldownMs = 30_000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.state = new Map();
  }

  canRun(key) {
    const entry = this.state.get(key);
    if (!entry) return true;
    if (entry.failures < this.failureThreshold) return true;
    return Date.now() - entry.lastFailureAt > this.cooldownMs;
  }

  success(key) {
    this.state.delete(key);
  }

  failure(key) {
    const entry = this.state.get(key) || { failures: 0, lastFailureAt: 0 };
    entry.failures += 1;
    entry.lastFailureAt = Date.now();
    this.state.set(key, entry);
  }

  status(key) {
    const entry = this.state.get(key);
    if (!entry) return { open: false, failures: 0 };
    return {
      open: !this.canRun(key),
      failures: entry.failures,
      lastFailureAt: entry.lastFailureAt
    };
  }
}

module.exports = {
  CircuitBreaker
};
