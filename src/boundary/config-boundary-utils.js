'use strict';

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    return fallback !== undefined ? fallback : null;
  }
}

function isDangerousFlag(name) {
  const dangerous = ['AUTO_APPROVE_ENABLED', 'AUTO_RUN_ENABLED', 'SHELL_EXECUTOR_ENABLED'];
  return dangerous.includes(name);
}

function isSensitiveEnv(name) {
  const sensitive = /password|secret|token|key|api.?key|private.?key|access.?key|auth|credential|hash|salt|jwt|session.?secret|DATABASE_URL|REDIS_URL|ENCRYPTION_KEY|TELEGRAM_BOT_TOKEN|GITHUB_TOKEN|LLM_API_KEY/i;
  return sensitive.test(name);
}

function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  const secretKeys = /password|secret|token|key|api.?key|private.?key|access.?key|auth|credential|hash|salt|jwt|session.?secret/i;
  for (const key of Object.keys(copy)) {
    const val = copy[key];
    if (secretKeys.test(key) && typeof val === 'string') {
      copy[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      copy[key] = redactSecrets(val);
    }
  }
  return copy;
}

module.exports = {
  safeCall,
  isDangerousFlag,
  redactSecrets,
  isSensitiveEnv
};
