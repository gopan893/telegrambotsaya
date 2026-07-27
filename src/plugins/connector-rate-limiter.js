'use strict';

const rateBuckets = new Map();

function getRateLimitBucket(connectorId) {
  if (!rateBuckets.has(connectorId)) {
    rateBuckets.set(connectorId, { tokens: 60, lastRefill: Date.now(), capacity: 60, refillRate: 1, refillInterval: 1000 });
  }
  return rateBuckets.get(connectorId);
}

function refillBucket(bucket) {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / bucket.refillInterval) * bucket.refillRate;
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

function consumeToken(connectorId) {
  const bucket = getRateLimitBucket(connectorId);
  refillBucket(bucket);
  if (bucket.tokens < 1) return { allowed: false, retryAfter: Math.ceil((1 - bucket.tokens) * bucket.refillInterval) };
  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens };
}

function setRateLimit(connectorId, capacity, refillRate, refillInterval) {
  rateBuckets.set(connectorId, { tokens: capacity, lastRefill: Date.now(), capacity, refillRate, refillInterval });
}

function getRateLimitStatus(connectorId) {
  const bucket = getRateLimitBucket(connectorId);
  refillBucket(bucket);
  return { connectorId, remaining: bucket.tokens, capacity: bucket.capacity, refillRate: bucket.refillRate, refillIntervalMs: bucket.refillInterval };
}

function resetAllRateLimits() {
  rateBuckets.clear();
}

module.exports = { consumeToken, setRateLimit, getRateLimitStatus, resetAllRateLimits };
