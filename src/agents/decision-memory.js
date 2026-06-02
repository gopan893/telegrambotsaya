'use strict';

const utils = require('./decision-utils');

function shouldSaveDecisionMemory(decision = {}, services = {}) {
  const text = `${decision.question || ''} ${decision.title || ''}`.toLowerCase();
  if (decision.approvalRequired || ['high', 'danger'].includes(decision.riskLevel)) return true;
  if (/\b(phase|roadmap|postgres|json|storage|multi-bot|agent|security|backup|restore|coding)\b/.test(text)) return true;
  return false;
}

function buildDecisionMemoryItem(decision = {}) {
  return utils.sanitizeDecisionPayload({
    id: utils.createId('decision_summary'),
    decisionId: decision.id,
    workspaceId: decision.workspaceId,
    userId: decision.userId,
    type: 'decision_summary',
    title: decision.title,
    content: [
      `Question: ${decision.question}`,
      `Recommendation: ${decision.recommendation?.recommendation || '-'}`,
      `Confidence: ${decision.confidence?.level || '-'}`,
      `Approval required: ${decision.approvalRequired ? 'yes' : 'no'}`
    ].join('\n'),
    confidence: decision.confidence?.score || 0.5,
    riskLevel: decision.riskLevel,
    createdAt: utils.nowIso()
  });
}

async function saveDecisionSummary(decision = {}, services = {}) {
  if (!shouldSaveDecisionMemory(decision, services)) return null;
  const item = buildDecisionMemoryItem(decision);
  const items = await utils.safeRead(utils.AGENT_DECISION_SUMMARIES_KEY, [], services);
  const list = Array.isArray(items) ? items : [];
  list.unshift(item);
  await utils.safeWrite(utils.AGENT_DECISION_SUMMARIES_KEY, list.slice(0, 1000), services);
  await utils.auditDecision('agents/decision_summary_memory_created', {
    decisionId: decision.id,
    workspaceId: decision.workspaceId,
    userId: decision.userId,
    riskLevel: decision.riskLevel,
    confidence: decision.confidence?.level
  }, services);
  return item;
}

async function createAgentLearningFromDecision(decision = {}, services = {}) {
  if (!services.learningNotes?.createLearningNote) return [];
  const notes = [];
  const agentId = decision.riskLevel === 'danger' || decision.approvalRequired ? 'security' : 'planner';
  try {
    const note = await services.learningNotes.createLearningNote({
      agentId,
      workspaceId: decision.workspaceId,
      userId: decision.userId,
      content: `Decision learning: ${decision.recommendation?.recommendation || decision.question}`,
      tags: ['decision', 'phase24'],
      createdBy: decision.userId
    }, services);
    notes.push(note);
  } catch (_) {}
  return notes;
}

module.exports = {
  buildDecisionMemoryItem,
  createAgentLearningFromDecision,
  saveDecisionSummary,
  shouldSaveDecisionMemory
};
