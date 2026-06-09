'use strict';

const ERROR_MAP = {
  ECONNREFUSED: { type: 'connection_refused', retryable: true, message: 'Connection refused by remote server' },
  ECONNRESET: { type: 'connection_reset', retryable: true, message: 'Connection was reset' },
  ETIMEDOUT: { type: 'timeout', retryable: true, message: 'Connection timed out' },
  ENOTFOUND: { type: 'dns_error', retryable: false, message: 'DNS lookup failed' },
  UNAUTHORIZED: { type: 'auth_error', retryable: false, message: 'Authentication failed' },
  RATE_LIMITED: { type: 'rate_limited', retryable: true, message: 'Rate limited by remote server' },
  UNKNOWN: { type: 'unknown', retryable: false, message: 'Unknown error occurred' }
};

function mapError(error) {
  const code = error.code || error.status || error.type || 'UNKNOWN';
  const mapped = ERROR_MAP[code] || ERROR_MAP.UNKNOWN;
  return { ...mapped, originalCode: code, detail: error.message || '' };
}

function isRetryable(error) {
  return mapError(error).retryable;
}

function classifyError(error) {
  const mapped = mapError(error);
  if (mapped.type === 'auth_error') return 'security';
  if (mapped.type === 'rate_limited') return 'throttle';
  if (mapped.retryable) return 'transient';
  return 'permanent';
}

module.exports = { mapError, isRetryable, classifyError };
