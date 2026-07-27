/**
 * Registry v3 Utilities
 * Shared utility functions for registry v3
 */

function normalizeId(id) {
  if (!id) return null;
  return String(id).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
}

function normalizeCanonicalId(id, type) {
  if (!id) return null;
  const normalized = normalizeId(id);
  return type ? `${type}:${normalized}` : normalized;
}

function isValidId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-z0-9_-]+$/.test(id);
}

function isValidType(type) {
  const validTypes = [
    'dashboard_tab',
    'dashboard_api',
    'dashboard_renderer',
    'telegram_command',
    'capability',
    'alias',
    'module',
    'workflow',
    'device',
    'plugin',
    'model_route'
  ];
  return validTypes.includes(type);
}

function isValidStatus(status) {
  const validStatuses = ['draft', 'active', 'deprecated', 'blocked', 'unknown'];
  return validStatuses.includes(status);
}

function isValidVisibility(visibility) {
  const validVisibilities = ['public', 'admin', 'owner', 'internal', 'hidden'];
  return validVisibilities.includes(visibility);
}

function isValidRiskLevel(riskLevel) {
  const validRiskLevels = ['low', 'medium', 'high', 'critical'];
  return validRiskLevels.includes(riskLevel);
}

function isValidActionType(actionType) {
  const validActionTypes = [
    'read',
    'report',
    'simulate',
    'dry_run',
    'proposal',
    'internal_write',
    'external_write',
    'dangerous'
  ];
  return validActionTypes.includes(actionType);
}

function isDangerousActionType(actionType) {
  return ['external_write', 'dangerous'].includes(actionType);
}

function requiresApprovalByDefault(item) {
  if (!item) return false;
  if (item.riskLevel === 'critical') return true;
  if (item.riskLevel === 'high' && isDangerousActionType(item.actionType)) return true;
  return false;
}

function sanitizeForDisplay(obj, redactSecrets = true) {
  if (!obj) return obj;
  const sanitized = JSON.parse(JSON.stringify(obj));

  if (redactSecrets) {
    const secretPatterns = [
      /token/i, /key/i, /secret/i, /password/i, /credential/i,
      /auth/i, /bearer/i, /api[_-]?key/i, /database[_-]?url/i
    ];

    function redact(o) {
      if (typeof o !== 'object' || o === null) return;
      for (const key in o) {
        if (secretPatterns.some(p => p.test(key))) {
          o[key] = '[REDACTED]';
        } else if (typeof o[key] === 'object') {
          redact(o[key]);
        }
      }
    }

    redact(sanitized);
  }

  return sanitized;
}

function generateRegistryId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `reg-v3-${timestamp}-${random}`;
}

module.exports = {
  normalizeId,
  normalizeCanonicalId,
  isValidId,
  isValidType,
  isValidStatus,
  isValidVisibility,
  isValidRiskLevel,
  isValidActionType,
  isDangerousActionType,
  requiresApprovalByDefault,
  sanitizeForDisplay,
  generateRegistryId
};
