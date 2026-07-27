'use strict';

const utils = require('./model-strategy-utils');

const SECRET_PATTERNS = [
  /TELEGRAM_TOKEN/gi, /DATABASE_URL/gi, /REDIS_URL/gi, /GITHUB_TOKEN/gi,
  /API_KEY/gi, /SECRET/gi, /PASSWORD/gi, /CREDENTIAL/gi,
  /sk-[A-Za-z0-9_-]{3,}/g, /ghp_[A-Za-z0-9_]{3,}/g, /github_pat_[A-Za-z0-9_]{3,}/g,
  /Bearer\s+\S+/gi, /Authorization:\s*\S+/gi
];

const BLOCKED_CONTENT_PATTERNS = [
  /life.?os.*private.*note/i, /mood.*journal.*entry/i,
  /raw.*database.*url/i, /connection.*string.*password/i
];

function blockUnsafeRoute(route = {}, task = {}, services = {}) {
  if (!route) return { blocked: false };
  if (task.sensitivity === 'high' && route.type !== 'local') {
    return { blocked: true, reason: 'high_sensitivity_non_local_route' };
  }
  if (task.class === 'private_lifeos' && route.type !== 'local') {
    return { blocked: true, reason: 'private_lifeos_non_local_route' };
  }
  if (route.type === 'cloud' && services.privacyMode === 'local_only') {
    return { blocked: true, reason: 'privacy_mode_local_only' };
  }
  if (route.provider && /free.*tier|untrusted/i.test(String(route.provider))) {
    return { blocked: true, reason: 'untrusted_provider' };
  }
  return { blocked: false };
}

function redactInput(text = '', services = {}) {
  let safe = String(text);
  const guard = services.secretGuard || null;
  if (guard?.sanitize) return guard.sanitize(safe);
  for (const p of SECRET_PATTERNS) {
    safe = safe.replace(p, '[REDACTED]');
  }
  return safe;
}

function blockRawSecrets(text = '', services = {}) {
  for (const p of SECRET_PATTERNS) {
    if (p.test(String(text))) {
      return { blocked: true, reason: 'raw_secret_detected', pattern: p.source };
    }
  }
  for (const p of BLOCKED_CONTENT_PATTERNS) {
    if (p.test(String(text))) {
      return { blocked: true, reason: 'sensitive_content_detected', pattern: p.source };
    }
  }
  return { blocked: false };
}

function validateRouteForPrivacy(route = {}, services = {}) {
  const issues = [];
  if (route.type === 'cloud' && !route.redacted) {
    issues.push({ level: 'warning', message: 'Cloud route without redaction confirmation' });
  }
  if (route.type === 'local' && services.privacyMode === 'strict') {
    return { valid: true, issues: [] };
  }
  if (route.type === 'cloud' && services.privacyMode === 'strict') {
    issues.push({ level: 'error', message: 'Cloud route blocked in strict privacy mode' });
  }
  return { valid: !issues.some(i => i.level === 'error'), issues };
}

function shouldBlockRoute(task = {}, route = {}, services = {}) {
  const secretCheck = blockRawSecrets(task.input || task.description || '', services);
  if (secretCheck.blocked) return { block: true, reason: secretCheck.reason };
  const routeCheck = blockUnsafeRoute(route, task, services);
  if (routeCheck.blocked) return { block: true, reason: routeCheck.reason };
  return { block: false };
}

module.exports = { blockUnsafeRoute, redactInput, blockRawSecrets, validateRouteForPrivacy, shouldBlockRoute };
