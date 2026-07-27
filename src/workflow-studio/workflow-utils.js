'use strict';

const crypto = require('crypto');

const VALID_STATUSES = ['draft', 'validated', 'blocked', 'proposal_created', 'approved', 'running', 'completed', 'failed', 'disabled'];
const VALID_STEP_TYPES = ['read', 'analyze', 'summarize', 'notify', 'internal_write', 'external_read', 'external_write', 'device_action', 'plugin_action', 'rag_search', 'model_route', 'proposal', 'approval_gate', 'blocked'];
const VALID_TRIGGER_TYPES = ['manual', 'schedule', 'webhook', 'event', 'error', 'health_degraded'];
const BLOCKED_STEP_TYPES = ['blocked'];

function generateWorkflowId(name) {
  const slug = (name || 'workflow').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  return `${slug}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function sanitizeText(text, max) {
  max = max || 500;
  return String(text || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, max).trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

function isValidStepType(stepType) {
  return VALID_STEP_TYPES.includes(stepType);
}

function isBlockedStepType(stepType) {
  return BLOCKED_STEP_TYPES.includes(stepType);
}

function formatWorkflowSummary(workflow) {
  const statusBadge = (workflow.status || 'draft').toUpperCase();
  const stepCount = (workflow.steps || []).length;
  return `[${statusBadge}] ${workflow.name} — ${stepCount} steps, risk: ${workflow.riskLevel || 'low'}`;
}

function estimateWorkflowComplexity(workflow) {
  let score = 0;
  score += (workflow.steps || []).length * 2;
  const externalSteps = (workflow.steps || []).filter(s => s.type && (s.type.startsWith('external_') || s.type === 'device_action'));
  score += externalSteps.length * 5;
  if (workflow.evaluationRequired) score += 3;
  if (workflow.dryRunRequired) score += 2;
  if (workflow.approvalMap && Object.keys(workflow.approvalMap).length > 0) score += 5;
  return { score, level: score <= 5 ? 'simple' : score <= 15 ? 'moderate' : 'complex' };
}

function redactSensitive(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/TELEGRAM_TOKEN/gi, '[REDACTED_SECRET]')
    .replace(/DATABASE_URL/gi, '[REDACTED_SECRET]')
    .replace(/REDIS_URL/gi, '[REDACTED_SECRET]')
    .replace(/GITHUB_TOKEN/gi, '[REDACTED_SECRET]')
    .replace(/API_KEY[=:]\s*\S+/gi, 'API_KEY=[REDACTED_SECRET]')
    .replace(/SECRET[=:]\s*\S+/gi, 'SECRET=[REDACTED_SECRET]')
    .replace(/PASSWORD[=:]\s*\S+/gi, 'PASSWORD=[REDACTED_SECRET]');
}

function isQuietHours(quietHours) {
  if (!quietHours || !quietHours.start || !quietHours.end) return false;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const current = currentHour * 60 + currentMinute;
  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);
  const start = (startH || 0) * 60 + (startM || 0);
  const end = (endH || 0) * 60 + (endM || 0);
  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

module.exports = {
  generateWorkflowId, sanitizeText, safeArray, clamp,
  isValidStatus, isValidStepType, isBlockedStepType,
  formatWorkflowSummary, estimateWorkflowComplexity,
  redactSensitive, isQuietHours,
  VALID_STATUSES, VALID_STEP_TYPES, VALID_TRIGGER_TYPES, BLOCKED_STEP_TYPES
};
