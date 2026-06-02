'use strict';

const {
  buildSafeText,
  containsSecretLike,
  createId,
  maskSecret,
  normalizeId,
  nowIso,
  safeRead,
  safeWrite,
  unique
} = require('./agent-utils');

const COUNCIL_SESSIONS_KEY = 'agent_council_sessions';
const COUNCIL_SUMMARIES_KEY = 'agent_council_summaries';
const DEBATE_RECORDS_KEY = 'agent_debate_records';
const COUNCIL_RECENT_KEY = 'agent_council_recent_fingerprints';

const SECRET_WARNING = 'Konten berisi pola sensitif dan sudah disanitasi.';

function normalizeWorkspaceId(value) {
  return String(value || 'default').trim() || 'default';
}

function normalizeUserId(value) {
  return String(value || '').trim();
}

function sanitizeCouncilText(text = '', max = 1000) {
  return buildSafeText(maskSecret(String(text || '').replace(/\s+/g, ' ').trim()), max);
}

function sanitizeCouncilPayload(payload = {}) {
  if (payload === null || typeof payload === 'undefined') return payload;
  if (typeof payload === 'string') return sanitizeCouncilText(payload, 1400);
  if (Array.isArray(payload)) return payload.map(sanitizeCouncilPayload);
  if (typeof payload !== 'object') return payload;

  const output = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowered = key.toLowerCase();
    if (['token', 'secret', 'password', 'authorization', 'api_key', 'apikey', 'database_url', 'redis_url'].some(part => lowered.includes(part))) {
      output[key] = value ? '[REDACTED]' : value;
    } else {
      output[key] = sanitizeCouncilPayload(value);
    }
  }
  return output;
}

function createCouncilId(prefix = 'council') {
  return createId(prefix);
}

function inferRiskLevel(value = 'low') {
  const low = String(value || 'low').toLowerCase();
  if (['danger', 'high', 'medium', 'low'].includes(low)) return low;
  return 'low';
}

function isDangerousActionText(text = '') {
  return /\b(restore|import|overwrite|delete|hapus|run|jalankan|eksekusi|approve|external|webhook|token|secret|api key|database_url|redis_url)\b/i.test(String(text || ''));
}

function isDecisionText(text = '') {
  return /\b(pilih|lebih baik|opsi|option|decision|keputusan|pros|cons|pro kontra|bandingkan|menurut kalian)\b/i.test(String(text || ''));
}

function isPlanningText(text = '') {
  return /\b(phase|tahap|lanjut|roadmap|prioritas|rencana|langkah|minggu ini|milestone)\b/i.test(String(text || ''));
}

function isArchitectureText(text = '') {
  return /\b(arsitektur|architecture|schema|database|postgres|redis|render|deploy|bot|api|commonjs|node\.js|webhook)\b/i.test(String(text || ''));
}

function isEmotionalText(text = '') {
  return /\b(sedih|capek|lelah|pusing|cemas|stress|stres|takut|kecewa)\b/i.test(String(text || ''));
}

function buildCouncilFingerprint(message = '', context = {}) {
  const text = sanitizeCouncilText(message, 100).toLowerCase();
  return `${context.chatId || ''}:${context.userId || ''}:${text}`;
}

async function isRecentCouncilDuplicate(message = '', context = {}, services = {}) {
  const key = buildCouncilFingerprint(message, context);
  const store = await safeRead(COUNCIL_RECENT_KEY, {}, services);
  const now = Date.now();
  const ttlMs = Number(services.councilDuplicateTtlMs || 90000);
  for (const [fingerprint, item] of Object.entries(store)) {
    if (now - Number(item.ts || 0) > ttlMs) delete store[fingerprint];
  }
  const exists = Boolean(store[key]);
  if (!exists) store[key] = { ts: now };
  await safeWrite(COUNCIL_RECENT_KEY, store, services);
  return exists;
}

async function auditCouncil(action, summary = {}, services = {}) {
  try {
    await services.auditLog?.recordAuditLog?.({
      actorType: summary.actorType || services.actorType || 'system',
      actorId: String(summary.actorId || services.actorId || summary.userId || ''),
      action,
      targetType: summary.targetType || 'agent_council',
      targetId: summary.sessionId || summary.targetId || '',
      userId: summary.userId || services.userId || '',
      workspaceId: summary.workspaceId || services.workspaceId || '',
      decision: summary.decision || 'allowed',
      status: summary.status || 'ok',
      afterSummary: sanitizeCouncilPayload(summary)
    }, services);
  } catch (_) {}
}

function buildEmptyCouncilSession(input = {}) {
  const originalMessage = sanitizeCouncilText(input.originalMessage || input.topic || '', 600);
  return sanitizeCouncilPayload({
    id: input.id || createCouncilId('council'),
    workspaceId: normalizeWorkspaceId(input.workspaceId),
    userId: normalizeUserId(input.userId),
    chatId: String(input.chatId || ''),
    messageId: input.messageId || null,
    source: input.source || 'natural_chat',
    mode: input.mode || 'quick_council',
    topic: sanitizeCouncilText(input.topic || originalMessage || 'Council session', 180),
    originalMessage,
    selectedAgents: unique(input.selectedAgents || ['orchestrator']),
    visibleAgents: unique(input.visibleAgents || []),
    internalOnlyAgents: unique(input.internalOnlyAgents || []),
    riskLevel: inferRiskLevel(input.riskLevel),
    status: 'created',
    opinions: [],
    critiques: [],
    decision: null,
    finalSummary: '',
    actionRecommendations: [],
    approvalRequired: Boolean(input.approvalRequired),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
    completedAt: null
  });
}

module.exports = {
  COUNCIL_RECENT_KEY,
  COUNCIL_SESSIONS_KEY,
  COUNCIL_SUMMARIES_KEY,
  DEBATE_RECORDS_KEY,
  SECRET_WARNING,
  auditCouncil,
  buildCouncilFingerprint,
  buildEmptyCouncilSession,
  containsSecretLike,
  createCouncilId,
  inferRiskLevel,
  isArchitectureText,
  isDangerousActionText,
  isDecisionText,
  isEmotionalText,
  isPlanningText,
  isRecentCouncilDuplicate,
  maskSecret,
  normalizeId,
  normalizeUserId,
  normalizeWorkspaceId,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeCouncilPayload,
  sanitizeCouncilText,
  unique
};
