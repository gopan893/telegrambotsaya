'use strict';

const crypto = require('crypto');

const FINDINGS = [];

function generateId() {
  return crypto.createHash('sha1').update(`sf:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function classifySecretFinding(rawFinding) {
  if (!rawFinding || !rawFinding.secretType) return null;

  const finding = {
    id: generateId(),
    workspaceId: rawFinding.workspaceId || 'default',
    surface: rawFinding.surface || 'unknown',
    location: rawFinding.location || '',
    secretType: rawFinding.secretType,
    severity: rawFinding.severity || classifySeverity(rawFinding.secretType, rawFinding.confidence),
    confidence: typeof rawFinding.confidence === 'number' ? rawFinding.confidence : 0.5,
    redactedSample: rawFinding.redactedSample || '[REDACTED]',
    recommendedAction: rawFinding.recommendedAction || recommendAction(rawFinding.secretType, rawFinding.severity),
    status: 'open',
    createdAt: new Date().toISOString()
  };

  FINDINGS.push(finding);
  return finding;
}

function classifySeverity(secretType, confidence) {
  const criticalTypes = [
    'TELEGRAM_TOKEN', 'GITHUB_TOKEN', 'DATABASE_URL', 'REDIS_URL',
    'GOOGLE_CLIENT_SECRET', 'CLOUDFLARE_API_TOKEN', 'RENDER_API_KEY',
    'DASHBOARD_ADMIN_TOKEN', 'OPENAI_API_KEY', 'GROQ_API_KEY',
    'POSTGRESQL_URL', 'REDIS_URL_CONNECTION', 'GEMINI_API_KEY',
    'MISTRAL_API_KEY', 'TAVILY_API_KEY', 'OPENWEATHER_API_KEY',
    'BEARER_TOKEN'
  ];
  const highTypes = ['PASSWORD_VALUE', 'SECRET_VALUE', 'API_KEY_VALUE', 'TOKEN_VALUE', 'AUTH_HEADER'];

  if (criticalTypes.some(t => secretType.startsWith(t))) return 'critical';
  if (highTypes.some(t => secretType.startsWith(t))) return 'high';
  if (confidence >= 0.8) return 'medium';
  if (confidence >= 0.5) return 'low';
  return 'info';
}

function recommendAction(secretType, severity) {
  if (severity === 'critical') return 'rotate_and_remove';
  if (severity === 'high') return 'review_and_rotate';
  if (severity === 'medium') return 'verify_and_clean';
  return 'monitor';
}

function estimateSecretExposureRisk(finding) {
  if (!finding) return 0;
  const severityWeights = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
  const weight = severityWeights[finding.severity] || 1;
  const confidence = finding.confidence || 0.5;
  return Math.min(10, Math.round(weight * confidence * 2));
}

function buildRedactedFinding(rawFinding) {
  return {
    surface: rawFinding.surface,
    location: rawFinding.location,
    secretType: rawFinding.secretType,
    severity: rawFinding.severity,
    confidence: rawFinding.confidence,
    redactedSample: '[REDACTED]',
    recommendedAction: rawFinding.recommendedAction,
    status: rawFinding.status || 'open'
  };
}

function recommendSecretFindingAction(finding) {
  if (!finding) return 'No finding data.';
  const actions = {
    rotate_and_remove: 'Rotate credential immediately and remove leaked copy.',
    review_and_rotate: 'Review if credential is real and rotate if confirmed.',
    verify_and_clean: 'Verify if this is a real credential or false positive, clean if real.',
    monitor: 'Monitor for future occurrences.'
  };
  return actions[finding.recommendedAction] || 'Investigate finding.';
}

function listFindings({ severity, status, surface, limit } = {}) {
  let results = [...FINDINGS];
  if (severity) results = results.filter(f => f.severity === severity);
  if (status) results = results.filter(f => f.status === status);
  if (surface) results = results.filter(f => f.surface === surface);
  results.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  if (limit) results = results.slice(0, limit);
  return results;
}

function getFinding(findingId) {
  return FINDINGS.find(f => f.id === findingId) || null;
}

function updateFindingStatus(findingId, status) {
  const finding = FINDINGS.find(f => f.id === findingId);
  if (!finding) return null;
  finding.status = status;
  return finding;
}

function getFindingsStats() {
  return {
    total: FINDINGS.length,
    bySeverity: { critical: FINDINGS.filter(f => f.severity === 'critical').length, high: FINDINGS.filter(f => f.severity === 'high').length, medium: FINDINGS.filter(f => f.severity === 'medium').length, low: FINDINGS.filter(f => f.severity === 'low').length, info: FINDINGS.filter(f => f.severity === 'info').length },
    byStatus: { open: FINDINGS.filter(f => f.status === 'open').length, ignored: FINDINGS.filter(f => f.status === 'ignored').length, rotation_planned: FINDINGS.filter(f => f.status === 'rotation_planned').length, resolved: FINDINGS.filter(f => f.status === 'resolved').length, false_positive: FINDINGS.filter(f => f.status === 'false_positive').length }
  };
}

module.exports = {
  classifySecretFinding,
  classifySeverity,
  estimateSecretExposureRisk,
  buildRedactedFinding,
  recommendSecretFindingAction,
  listFindings,
  getFinding,
  updateFindingStatus,
  getFindingsStats
};
