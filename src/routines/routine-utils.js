'use strict';

const crypto = require('crypto');

const SECRET_PATTERNS = [
  /token/gi, /secret/gi, /password/gi, /api_key/gi,
  /Authorization/gi, /Bearer/gi, /DATABASE_URL/gi, /REDIS_URL/gi,
  /postgresql:\/\//gi, /rediss:\/\//gi, /sk\-/gi, /ghp_/gi,
  /gsk_/gi, /tvly_/gi, /TELEGRAM_TOKEN/gi, /GITHUB_TOKEN/gi,
  /GOOGLE_CLIENT_SECRET/gi, /CLOUDFLARE_API_TOKEN/gi
];

const RISK_ORDER = { low: 1, medium: 2, high: 3, danger: 4 };

const ROUTINE_MODES = ['manual', 'scheduled_readonly', 'scheduled_dry_run', 'proposal_only'];
const SCHEDULE_PRESETS = ['manual', 'hourly', 'daily', 'weekly', 'monthly'];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'rout') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function sanitizeOutput(text) {
  let result = String(text || '');
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '***REDACTED***');
  }
  return result;
}

function validateMode(mode) {
  if (ROUTINE_MODES.includes(mode)) return mode;
  return 'manual';
}

function validateSchedulePreset(preset) {
  if (SCHEDULE_PRESETS.includes(preset)) return preset;
  return 'manual';
}

function computeNextRun(schedulePreset) {
  const now = new Date();
  switch (schedulePreset) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

function normalizeRiskLevel(value) {
  const clean = String(value || 'low').toLowerCase();
  return ['low', 'medium', 'high', 'danger'].includes(clean) ? clean : 'low';
}

function maxRiskLevel(values = []) {
  let max = 'low';
  for (const v of values) {
    const risk = normalizeRiskLevel(v);
    if ((RISK_ORDER[risk] || 0) > (RISK_ORDER[max] || 0)) max = risk;
  }
  return max;
}

function isWriteAction(action) {
  const writeKeywords = ['write', 'create', 'update', 'delete', 'remove', 'set', 'insert', 'modify'];
  return writeKeywords.some(k => String(action || '').toLowerCase().includes(k));
}

function isExternalAction(action) {
  const externalKeywords = ['github', 'email', 'calendar', 'webhook', 'cloudflare', 'nas', 'gmail', 'google'];
  return externalKeywords.some(k => String(action || '').toLowerCase().includes(k));
}

function isDangerAction(action) {
  const dangerKeywords = ['restore', 'delete', 'destroy', 'purge', 'shutdown', 'danger', 'high_risk'];
  return dangerKeywords.some(k => String(action || '').toLowerCase().includes(k));
}

module.exports = {
  nowIso,
  createId,
  sanitizeOutput,
  validateMode,
  validateSchedulePreset,
  computeNextRun,
  normalizeRiskLevel,
  maxRiskLevel,
  isWriteAction,
  isExternalAction,
  isDangerAction,
  ROUTINE_MODES,
  SCHEDULE_PRESETS,
  RISK_ORDER,
  SECRET_PATTERNS
};
