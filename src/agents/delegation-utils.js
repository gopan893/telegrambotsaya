'use strict';

const base = require('./agent-utils');
const outputSanitizer = require('../ai-os/output-sanitizer');
const fileIntentGuard = require('../multimodal/file-intent-guard');

const AGENT_DELEGATIONS_KEY = 'agent_delegations';
const AGENT_TASKS_KEY = 'agent_tasks';
const AGENT_TASK_RESULTS_KEY = 'agent_task_results';
const AGENT_HANDOFFS_KEY = 'agent_handoffs';
const DELEGATION_SUMMARIES_KEY = 'agent_delegation_summaries';

const TASK_TYPES = [
  'planning',
  'coding_review',
  'risk_review',
  'research_note',
  'ops_check',
  'memory_review',
  'decision_support',
  'summary',
  'handoff'
];

function normalizeWorkspaceId(value) {
  return String(value || 'default').trim() || 'default';
}

function sanitizeDelegationText(text = '', options = {}) {
  const userText = options.userText || text || '';
  const fileRelated = Boolean(options.fileRelated) || fileIntentGuard.isFileRelatedMessage(userText, options);
  return outputSanitizer.sanitizeAssistantVisibleText(base.buildSafeText(text, options.max || 1800), {
    userText,
    fileRelated,
    forceClean: true
  });
}

function sanitizeDelegationPayload(value, options = {}) {
  if (value === null || typeof value === 'undefined') return value;
  if (typeof value === 'string') return sanitizeDelegationText(value, options);
  if (Array.isArray(value)) return value.map(item => sanitizeDelegationPayload(item, options)).slice(0, options.maxItems || 50);
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (['token', 'secret', 'password', 'authorization', 'api_key', 'apikey', 'database_url', 'redis_url'].some(part => lowered.includes(part))) {
      out[key] = item ? '[REDACTED]' : item;
      continue;
    }
    out[key] = sanitizeDelegationPayload(item, options);
  }
  return out;
}

function normalizeRiskLevel(value = 'low') {
  const clean = String(value || 'low').toLowerCase();
  return ['low', 'medium', 'high', 'danger'].includes(clean) ? clean : 'low';
}

function normalizePriority(value = 'medium') {
  const clean = String(value || 'medium').toLowerCase();
  return ['low', 'medium', 'high'].includes(clean) ? clean : 'medium';
}

function normalizeTaskStatus(value = 'created') {
  const clean = String(value || 'created').toLowerCase();
  return ['created', 'queued', 'running', 'blocked', 'completed', 'failed', 'cancelled', 'archived'].includes(clean) ? clean : 'created';
}

function normalizeVisibility(value = 'internal') {
  const clean = String(value || 'internal').toLowerCase();
  return ['internal', 'visible', 'summary_only'].includes(clean) ? clean : 'internal';
}

function inferTaskTypeFromText(text = '') {
  const t = String(text || '').toLowerCase();
  if (/\b(error|deploy|render|webhook|health|postgres|redis|crash|ops)\b/.test(t)) return 'ops_check';
  if (/\b(code|coding|bug|implement|module|file|commonjs|api|refactor)\b/.test(t)) return 'coding_review';
  if (/\b(risk|risiko|aman|security|token|restore|import|delete|approval)\b/.test(t)) return 'risk_review';
  if (/\b(search|riset|research|sumber|latest|terbaru)\b/.test(t)) return 'research_note';
  if (/\b(memory|graph|konteks|ingat)\b/.test(t)) return 'memory_review';
  if (/\b(pilih|keputusan|decision|lebih baik|mana)\b/.test(t)) return 'decision_support';
  return 'planning';
}

function inferRiskFromText(text = '') {
  const t = String(text || '').toLowerCase();
  if (/\b(restore|import|overwrite|delete|hapus|drop|hard delete|token|secret|api key|database_url|redis_url|shell|execute|run external)\b/.test(t)) return 'danger';
  if (/\b(webhook|permission|admin|deploy production|migration|backup|external|write action)\b/.test(t)) return 'high';
  if (/\b(deploy|database|redis|postgres|automation|executor)\b/.test(t)) return 'medium';
  return 'low';
}

function requiresApprovalForText(text = '', riskLevel = 'low') {
  return ['high', 'danger'].includes(normalizeRiskLevel(riskLevel)) || /\b(restore|import|delete|hapus|overwrite|external|write|approve|runexec|shell)\b/i.test(text);
}

function buildEmptyDelegationSession(input = {}) {
  const now = base.nowIso();
  const text = sanitizeDelegationText(input.originalMessage || input.message || input.goal || '', { max: 900 });
  const riskLevel = normalizeRiskLevel(input.riskLevel || inferRiskFromText(text));
  return sanitizeDelegationPayload({
    id: input.id || base.createId('delegation'),
    workspaceId: normalizeWorkspaceId(input.workspaceId),
    userId: String(input.userId || ''),
    chatId: String(input.chatId || ''),
    messageId: input.messageId || '',
    source: input.source || 'natural_chat',
    originalMessageSummary: text,
    goal: sanitizeDelegationText(input.goal || text, { max: 420 }),
    selectedAgents: Array.isArray(input.selectedAgents) ? input.selectedAgents.slice(0, 6) : [],
    tasks: [],
    status: 'created',
    finalSummary: '',
    actionRecommendations: [],
    approvalRequired: Boolean(input.approvalRequired || requiresApprovalForText(text, riskLevel)),
    riskLevel,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  });
}

function buildAgentTask(input = {}) {
  const now = base.nowIso();
  const description = sanitizeDelegationText(input.description || input.input || input.title || '', { max: 1200 });
  const type = TASK_TYPES.includes(input.type) ? input.type : inferTaskTypeFromText(`${input.title} ${description}`);
  const riskLevel = normalizeRiskLevel(input.riskLevel || inferRiskFromText(description));
  return sanitizeDelegationPayload({
    id: input.id || base.createId('agent_task'),
    workspaceId: normalizeWorkspaceId(input.workspaceId),
    userId: String(input.userId || ''),
    chatId: String(input.chatId || ''),
    source: input.source || 'natural_chat',
    sourceId: input.sourceId || '',
    parentTaskId: input.parentTaskId || '',
    delegationId: input.delegationId || '',
    assignedAgentId: input.assignedAgentId || '',
    assignedBotId: input.assignedBotId || '',
    createdByAgentId: input.createdByAgentId || 'orchestrator',
    title: sanitizeDelegationText(input.title || type.replace(/_/g, ' '), { max: 160 }),
    description,
    input: sanitizeDelegationText(input.input || description, { max: 1000 }),
    expectedOutput: sanitizeDelegationText(input.expectedOutput || 'Ringkasan aman, rekomendasi, risiko, dan next step.', { max: 320 }),
    type,
    priority: normalizePriority(input.priority),
    status: normalizeTaskStatus(input.status || 'created'),
    visibility: normalizeVisibility(input.visibility || 'internal'),
    riskLevel,
    requiresApproval: Boolean(input.requiresApproval || requiresApprovalForText(description, riskLevel)),
    result: input.result || null,
    resultSummary: sanitizeDelegationText(input.resultSummary || '', { max: 900 }),
    confidence: Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 0.6,
    blockers: Array.isArray(input.blockers) ? input.blockers.slice(0, 8) : [],
    handoffToAgentId: input.handoffToAgentId || '',
    createdAt: input.createdAt || now,
    updatedAt: now,
    startedAt: input.startedAt || null,
    completedAt: input.completedAt || null,
    archivedAt: input.archivedAt || null
  });
}

async function auditDelegation(action, summary = {}, services = {}) {
  try {
    const entry = {
      actorType: services.actorType || 'system',
      actorId: services.actorId || summary.userId || '',
      action,
      targetType: summary.targetType || 'agent_delegation',
      targetId: summary.delegationId || summary.taskId || summary.id || '',
      workspaceId: normalizeWorkspaceId(summary.workspaceId || services.workspaceId),
      userId: summary.userId || services.userId || '',
      decision: summary.decision || 'allowed',
      status: summary.status || 'ok',
      afterSummary: sanitizeDelegationPayload(summary)
    };
    if (services.auditLog?.recordAuditLog) return await services.auditLog.recordAuditLog(entry, services);
    if (services.dashboardAuditLog?.recordAuditLog) return await services.dashboardAuditLog.recordAuditLog(entry, services);
  } catch (_) {}
  return null;
}

module.exports = {
  AGENT_DELEGATIONS_KEY,
  AGENT_HANDOFFS_KEY,
  AGENT_TASKS_KEY,
  AGENT_TASK_RESULTS_KEY,
  DELEGATION_SUMMARIES_KEY,
  TASK_TYPES,
  auditDelegation,
  buildAgentTask,
  buildEmptyDelegationSession,
  containsSecretLike: base.containsSecretLike,
  createId: base.createId,
  inferRiskFromText,
  inferTaskTypeFromText,
  normalizePriority,
  normalizeRiskLevel,
  normalizeTaskStatus,
  normalizeVisibility,
  normalizeWorkspaceId,
  nowIso: base.nowIso,
  requiresApprovalForText,
  safeRead: base.safeRead,
  safeWrite: base.safeWrite,
  sanitizeDelegationPayload,
  sanitizeDelegationText,
  unique: base.unique
};
