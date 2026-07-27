'use strict';

const utils = require('./knowledge-utils');

const SENSITIVE_TYPE_HINTS = ['token', 'secret', 'password', 'key', 'authorization', 'bearer'];

function detectSecretInMemory(candidate = {}, services = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return { found: false, sources: [], matches: [] };
  }
  const sources = [];
  const matches = [];
  for (const field of ['title', 'summary', 'content', 'description', 'text']) {
    if (candidate[field]) {
      const r = utils.detectSecretInText(String(candidate[field]));
      if (r.found) {
        sources.push(field);
        matches.push(...r.matches);
      }
    }
  }
  if (candidate.metadata && typeof candidate.metadata === 'object') {
    const r = utils.detectSecretInObject(candidate.metadata);
    if (r.found) {
      sources.push('metadata');
      matches.push(...r.matches);
    }
  }
  if (candidate.tags && Array.isArray(candidate.tags)) {
    for (const t of candidate.tags) {
      if (SENSITIVE_TYPE_HINTS.includes(String(t).toLowerCase())) {
        sources.push('tag');
        matches.push(`tag:${t}`);
      }
    }
  }
  return {
    found: matches.length > 0,
    sources: Array.from(new Set(sources)),
    matches: Array.from(new Set(matches)).slice(0, 20)
  };
}

function redactSensitiveMemory(candidate = {}, services = {}) {
  if (!candidate || typeof candidate !== 'object') return { candidate: {}, redacted: false };
  const redacted = JSON.parse(JSON.stringify(candidate));
  let changed = false;
  for (const field of ['title', 'summary', 'content', 'description', 'text']) {
    if (redacted[field]) {
      const before = String(redacted[field]);
      const after = utils.sanitizeString(before);
      if (after !== before) {
        redacted[field] = after;
        changed = true;
      }
    }
  }
  if (redacted.metadata && typeof redacted.metadata === 'object') {
    const safeMeta = utils.redactObject(redacted.metadata);
    if (JSON.stringify(safeMeta) !== JSON.stringify(redacted.metadata)) {
      redacted.metadata = safeMeta;
      changed = true;
    }
  }
  return { candidate: redacted, redacted: changed };
}

function blockUnsafeMemory(candidate = {}, services = {}) {
  const detection = detectSecretInMemory(candidate, services);
  if (!detection.found) return { blocked: false, reason: 'safe', detection };
  return {
    blocked: true,
    reason: 'secret_detected',
    detection,
    safeSummary: 'A secret was provided and redacted.',
    redaction: utils.REDACTION_PLACEHOLDER
  };
}

function buildMemorySafetyReport(candidate = {}, services = {}) {
  const detection = detectSecretInMemory(candidate, services);
  const block = blockUnsafeMemory(candidate, services);
  const redaction = redactSensitiveMemory(candidate, services);
  return {
    candidateId: candidate.id || null,
    detected: detection.found,
    sources: detection.sources,
    matchCount: detection.matches.length,
    redacted: redaction.redacted,
    blocked: block.blocked,
    safeToStore: !block.blocked,
    safeSummary: block.blocked ? 'A secret was provided and redacted.' : null,
    redactionPlaceholder: utils.REDACTION_PLACEHOLDER,
    generatedAt: utils.nowIso()
  };
}

function runMemorySafetyGate(candidate = {}, services = {}) {
  const detection = detectSecretInMemory(candidate, services);
  if (detection.found) {
    return {
      ok: false,
      blocked: true,
      reason: 'secret_detected',
      safeSummary: 'A secret was provided and redacted.',
      detection,
      report: buildMemorySafetyReport(candidate, services)
    };
  }
  return {
    ok: true,
    blocked: false,
    reason: 'safe',
    candidate: redactSensitiveMemory(candidate, services).candidate,
    report: buildMemorySafetyReport(candidate, services)
  };
}

module.exports = {
  detectSecretInMemory,
  redactSensitiveMemory,
  blockUnsafeMemory,
  buildMemorySafetyReport,
  runMemorySafetyGate
};
