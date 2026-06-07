'use strict';

const utils = require('./research-utils');

function detectSecretInResearchInput(input = {}) {
  if (utils.containsSecretLike(input)) return true;
  const raw = typeof input === 'string' ? input : JSON.stringify(input || '');
  const mentionsSecretName = /\b(GITHUB_TOKEN|TELEGRAM_TOKEN|DATABASE_URL|REDIS_URL|GOOGLE_CLIENT_SECRET|CLOUDFLARE_API_TOKEN|RENDER_DEPLOY_HOOK)\b/i.test(raw);
  const storageIntent = /\b(simpan|store|source|sumber|catat|remember|ingat|save|masukkan)\b/i.test(raw);
  return mentionsSecretName && storageIntent;
}

function redactResearchSensitiveContent(input = {}) {
  return utils.sanitizePayload(input, { maxString: 1400, maxItems: 200, maxKeys: 80 });
}

function blockUnsafeResearchStorage(input = {}) {
  const hasSecret = detectSecretInResearchInput(input);
  return {
    allowed: !hasSecret,
    blocked: hasSecret,
    reason: hasSecret ? 'SECRET_LIKE_RESEARCH_INPUT_BLOCKED' : '',
    sanitizedInput: redactResearchSensitiveContent(input)
  };
}

function buildResearchSafetyReport(input = {}) {
  const storage = blockUnsafeResearchStorage(input);
  return {
    ok: storage.allowed,
    allowed: storage.allowed,
    blocked: storage.blocked,
    warnings: storage.blocked ? ['Secret-like content was redacted and will not be stored.'] : [],
    reason: storage.reason,
    sanitizedInput: storage.sanitizedInput
  };
}

function runResearchSafetyGate(input = {}, services = {}) {
  const report = buildResearchSafetyReport(input);
  if (report.blocked) {
    utils.auditResearch('research/secret_redacted', {
      workspaceId: input.workspaceId || services.workspaceId || 'default',
      userId: input.userId || services.userId || services.actorId || '',
      status: 'blocked',
      decision: 'denied',
      reason: report.reason,
      summary: { warning: 'Secret-like content redacted before storage.' }
    }, services);
  }
  return report;
}

module.exports = {
  blockUnsafeResearchStorage,
  buildResearchSafetyReport,
  detectSecretInResearchInput,
  redactResearchSensitiveContent,
  runResearchSafetyGate
};
