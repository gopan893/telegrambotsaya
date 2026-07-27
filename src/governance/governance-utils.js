'use strict';

function sanitizeForReport(text) {
  if (!text) return '';
  const sanitized = String(text)
    .replace(/(sk-\w{10,})/gi, '[REDACTED_API_KEY]')
    .replace(/(ghp_\w{10,})/gi, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(github_pat_\w{10,})/gi, '[REDACTED_GITHUB_PAT]')
    .replace(/(gsk_\w{10,})/gi, '[REDACTED_GROQ_KEY]')
    .replace(/(tvly_\w{10,})/gi, '[REDACTED_TOGETHER_KEY]')
    .replace(/(postgresql:\/\/[^\s]+)/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(rediss?:\/\/[^\s]+)/gi, '[REDACTED_REDIS_URL]');
  return sanitized;
}

function truncateActorId(actorId) {
  if (!actorId) return 'unknown';
  const str = String(actorId);
  if (str.length <= 8) return str;
  return str.slice(0, 4) + '...' + str.slice(-4);
}

function formatRiskBadge(riskLevel) {
  const badges = {
    'read_only': '🔵',
    'low': '🟢',
    'medium': '🟡',
    'high': '🟠',
    'danger': '🔴',
    'blocked': '⛔'
  };
  return badges[riskLevel] || '⚪';
}

function formatActionTypeBadge(actionType) {
  const badges = {
    'read': '📖',
    'report': '📊',
    'plan': '📋',
    'dry_run': '🧪',
    'proposal': '📝',
    'internal_write': '✏️',
    'external_read': '📡',
    'external_write': '📤',
    'dangerous': '⚠️',
    'destructive': '💥'
  };
  return badges[actionType] || '❓';
}

function buildGovernanceSummaryLine(decision) {
  if (!decision) return 'No governance data.';

  const icon = decision.allowed ? '✅' : (decision.blocked ? '🛡️' : '📋');
  const riskBadge = formatRiskBadge(decision.riskLevel);
  return `${icon} ${riskBadge} ${decision.actionId} → ${decision.outcome} (risk: ${decision.riskLevel})`;
}

function isRiskyAction(actionType) {
  return ['external_write', 'dangerous', 'destructive'].includes(actionType);
}

function isSafeAction(actionType) {
  return ['read', 'report', 'plan', 'dry_run'].includes(actionType);
}

function validateContext(context) {
  if (!context || typeof context !== 'object') return { valid: false, error: 'Context must be an object' };
  return { valid: true, context };
}

module.exports = {
  sanitizeForReport,
  truncateActorId,
  formatRiskBadge,
  formatActionTypeBadge,
  buildGovernanceSummaryLine,
  isRiskyAction,
  isSafeAction,
  validateContext
};
