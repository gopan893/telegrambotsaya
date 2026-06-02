'use strict';

const delegationUtils = require('./delegation-utils');

const AGENT_DECISIONS_KEY = 'agent_decisions';
const AGENT_DECISION_HISTORY_KEY = 'agent_decision_history';
const AGENT_DECISION_SUMMARIES_KEY = 'agent_decision_summaries';

const DEFAULT_CRITERIA = [
  { id: 'safety', name: 'Safety', weight: 1, description: 'Risiko keamanan, data, dan approval.' },
  { id: 'effort', name: 'Implementation effort', weight: 0.85, description: 'Kemudahan implementasi dan debugging.' },
  { id: 'stability', name: 'Stability', weight: 1, description: 'Dampak ke reliability dan fitur lama.' },
  { id: 'usefulness', name: 'Usefulness', weight: 0.85, description: 'Manfaat langsung untuk user/project.' },
  { id: 'speed', name: 'Speed', weight: 0.65, description: 'Kecepatan eksekusi.' },
  { id: 'cost', name: 'Cost/token usage', weight: 0.6, description: 'Biaya, token, latency, dan kompleksitas operasional.' },
  { id: 'reversibility', name: 'Reversibility', weight: 0.8, description: 'Seberapa mudah rollback atau ubah arah.' },
  { id: 'compatibility', name: 'Compatibility', weight: 0.9, description: 'Kesesuaian dengan CommonJS, Render, dan fitur lama.' },
  { id: 'control', name: 'User control', weight: 0.8, description: 'Tetap ada approval dan kontrol manusia.' },
  { id: 'long_term', name: 'Long-term value', weight: 0.75, description: 'Manfaat jangka panjang.' }
];

function sanitizeDecisionText(text = '', options = {}) {
  return delegationUtils.sanitizeDelegationText(text, options);
}

function sanitizeDecisionPayload(value, options = {}) {
  return delegationUtils.sanitizeDelegationPayload(value, options);
}

function normalizeDecisionStatus(value = 'draft') {
  const clean = String(value || 'draft').toLowerCase();
  return ['draft', 'analyzing', 'recommended', 'accepted', 'rejected', 'deferred', 'archived'].includes(clean) ? clean : 'draft';
}

function buildOption(input = {}, index = 0) {
  const label = sanitizeDecisionText(input.label || `Option ${index + 1}`, { max: 120 });
  const risk = delegationUtils.normalizeRiskLevel(input.estimatedRisk || input.riskLevel || delegationUtils.inferRiskFromText(`${label} ${input.description || ''}`));
  return sanitizeDecisionPayload({
    id: input.id || `option_${index + 1}`,
    label,
    description: sanitizeDecisionText(input.description || label, { max: 360 }),
    category: input.category || 'general',
    estimatedEffort: input.estimatedEffort || inferEffort(label),
    estimatedRisk: risk,
    expectedBenefit: input.expectedBenefit || inferBenefit(label),
    reversibility: input.reversibility || inferReversibility(label),
    dependencies: Array.isArray(input.dependencies) ? input.dependencies.slice(0, 8) : [],
    blockers: Array.isArray(input.blockers) ? input.blockers.slice(0, 8) : [],
    approvalRequired: Boolean(input.approvalRequired || delegationUtils.requiresApprovalForText(`${label} ${input.description || ''}`, risk)),
    score: Number.isFinite(Number(input.score)) ? Number(input.score) : 0
  });
}

function inferEffort(text = '') {
  const low = String(text).toLowerCase();
  if (/\b(10 bot|langsung|migrasi|restore|import|external|besar|full)\b/.test(low)) return 'large';
  if (/\b(bertahap|4 bot|stabilisasi|kecil|cek|review)\b/.test(low)) return 'small';
  return 'medium';
}

function inferBenefit(text = '') {
  const low = String(text).toLowerCase();
  if (/\b(production|postgres|stabil|security|backup|approval)\b/.test(low)) return 'high';
  if (/\b(defer|tunda|gather|cek dulu)\b/.test(low)) return 'medium';
  return 'medium';
}

function inferReversibility(text = '') {
  const low = String(text).toLowerCase();
  if (/\b(restore|overwrite|delete|hapus|langsung 10|migrasi)\b/.test(low)) return 'low';
  if (/\b(bertahap|4 bot|stabilisasi|preview|plan|cek)\b/.test(low)) return 'high';
  return 'medium';
}

function selectCriteria(message = '', topics = []) {
  const text = String(message || '').toLowerCase();
  const criteria = DEFAULT_CRITERIA.map(item => ({ ...item }));
  const boost = (id, amount) => {
    const item = criteria.find(c => c.id === id);
    if (item) item.weight = Math.min(1.5, item.weight + amount);
  };
  if (/\b(security|token|restore|import|aman|approval|permission)\b/.test(text) || topics.includes('security')) {
    boost('safety', 0.35);
    boost('reversibility', 0.25);
    boost('control', 0.25);
  }
  if (/\b(code|coding|deploy|render|postgres|redis|phase)\b/.test(text) || topics.includes('coding')) {
    boost('effort', 0.2);
    boost('stability', 0.25);
    boost('compatibility', 0.25);
  }
  if (/\b(roadmap|phase|lanjut|prioritas)\b/.test(text)) {
    boost('long_term', 0.25);
    boost('stability', 0.15);
  }
  if (/\b(capek|lelah|stress|pusing)\b/.test(text)) {
    boost('safety', 0.2);
    boost('reversibility', 0.2);
    boost('speed', -0.15);
  }
  return criteria;
}

function buildDecisionRecord(input = {}) {
  const now = delegationUtils.nowIso();
  const question = sanitizeDecisionText(input.question || input.message || input.title || '', { max: 900 });
  const options = (input.options || []).slice(0, 4).map(buildOption);
  const riskLevel = delegationUtils.normalizeRiskLevel(input.riskLevel || delegationUtils.inferRiskFromText(question));
  return sanitizeDecisionPayload({
    id: input.id || delegationUtils.createId('decision'),
    workspaceId: delegationUtils.normalizeWorkspaceId(input.workspaceId),
    userId: String(input.userId || ''),
    chatId: String(input.chatId || ''),
    messageId: input.messageId || '',
    source: input.source || 'natural_chat',
    sourceId: input.sourceId || '',
    title: sanitizeDecisionText(input.title || question || 'Decision analysis', { max: 160 }),
    question,
    contextSummary: sanitizeDecisionText(input.contextSummary || question, { max: 700 }),
    options,
    criteria: input.criteria || selectCriteria(question, input.topics || []),
    prosCons: input.prosCons || [],
    tradeoffs: input.tradeoffs || {},
    risks: input.risks || [],
    confidence: input.confidence || { score: 0.5, level: 'medium', reasons: [] },
    recommendation: input.recommendation || null,
    nextSteps: input.nextSteps || [],
    approvalRequired: Boolean(input.approvalRequired || delegationUtils.requiresApprovalForText(question, riskLevel) || options.some(option => option.approvalRequired)),
    executorProposalId: input.executorProposalId || '',
    status: normalizeDecisionStatus(input.status || 'draft'),
    riskLevel,
    createdAt: input.createdAt || now,
    updatedAt: now,
    decidedAt: input.decidedAt || null,
    archivedAt: input.archivedAt || null
  });
}

async function auditDecision(action, summary = {}, services = {}) {
  return delegationUtils.auditDelegation(action, {
    targetType: 'agent_decision',
    ...summary
  }, services);
}

module.exports = {
  AGENT_DECISIONS_KEY,
  AGENT_DECISION_HISTORY_KEY,
  AGENT_DECISION_SUMMARIES_KEY,
  DEFAULT_CRITERIA,
  auditDecision,
  buildDecisionRecord,
  buildOption,
  containsSecretLike: delegationUtils.containsSecretLike,
  createId: delegationUtils.createId,
  inferBenefit,
  inferEffort,
  inferReversibility,
  inferRiskFromText: delegationUtils.inferRiskFromText,
  normalizeDecisionStatus,
  normalizeRiskLevel: delegationUtils.normalizeRiskLevel,
  normalizeWorkspaceId: delegationUtils.normalizeWorkspaceId,
  nowIso: delegationUtils.nowIso,
  requiresApprovalForText: delegationUtils.requiresApprovalForText,
  safeRead: delegationUtils.safeRead,
  safeWrite: delegationUtils.safeWrite,
  sanitizeDecisionPayload,
  sanitizeDecisionText,
  selectCriteria,
  unique: delegationUtils.unique
};
