'use strict';

function isRetryableError(error) {
  const status = error?.response?.status || error?.status;
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true;

  const code = error?.code;
  return [
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ECONNABORTED',
    'ENOTFOUND'
  ].includes(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, options = {}) {
  const {
    retries = 2,
    baseDelayMs = 250,
    maxDelayMs = 2000,
    shouldRetry = isRetryableError,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) break;

      const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
      if (onRetry) onRetry(error, attempt + 1, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = {
  isRetryableError,
  withRetry
};
