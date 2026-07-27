'use strict';

const VALID_SCOPES = [
  'config_recovery', 'dashboard_recovery', 'postgres_recovery',
  'redis_recovery', 'render_redeploy_recovery', 'telegram_webhook_recovery',
  'github_actions_recovery', 'secret_rotation_rehearsal', 'full_ai_os_recovery'
];

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

function sanitizeDrData(data) {
  if (!data || typeof data !== 'object') return data;
  const out = Array.isArray(data) ? [] : {};
  for (const [key, value] of Object.entries(data)) {
    const lower = String(key).toLowerCase();
    if (lower.includes('token') || lower.includes('secret') || lower.includes('password') ||
        lower.includes('key') || lower.includes('credential') || lower.includes('api_key')) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeDrData(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function validateDrScope(scope) {
  return VALID_SCOPES.includes(scope) ? { ok: true, scope } : { ok: false, error: `INVALID_SCOPE: ${scope}` };
}

function validateRiskLevel(level) {
  return VALID_RISK_LEVELS.includes(level) ? { ok: true, level } : { ok: false, error: `INVALID_RISK_LEVEL: ${level}` };
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix || 'dr'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateEnvNameList() {
  return [
    'DATABASE_URL', 'REDIS_URL', 'TELEGRAM_TOKEN', 'GITHUB_TOKEN',
    'RENDER_API_KEY', 'DASHBOARD_ADMIN_TOKEN', 'BACKUP_ENCRYPTION_KEY',
    'CLOUDFLARE_API_TOKEN', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY'
  ];
}

module.exports = {
  generateEnvNameList,
  createId,
  nowIso,
  sanitizeDrData,
  validateDrScope,
  validateRiskLevel,
  VALID_SCOPES,
  VALID_RISK_LEVELS
};
