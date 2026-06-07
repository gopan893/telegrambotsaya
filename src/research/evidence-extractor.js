'use strict';

const store = require('./research-store');
const planner = require('./research-task-planner');
const utils = require('./research-utils');

function splitClaims(text = '') {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 24)
    .slice(0, 3);
}

function extractEvidenceFromSources(sources = [], task = {}, services = {}) {
  return utils.safeArray(sources).flatMap((source) => {
    const claims = splitClaims(source.safeExcerpt || source.summary || source.title);
    return claims.map((claim) => ({
      id: utils.createId('evidence'),
      taskId: task.id,
      sourceId: source.id,
      claim: utils.sanitizeText(claim, 280),
      supportSummary: utils.sanitizeText(source.summary || claim, 420),
      confidence: Math.max(0.2, Math.min(0.95, ((source.credibilityScore || 50) / 100) * 0.8 + ((source.relevanceScore || 50) / 100) * 0.2)),
      freshness: source.freshness || 'unknown',
      relevance: source.relevanceScore || Math.round(utils.textScore(`${task.topic} ${task.question}`, claim) * 100),
      limitations: source.status === 'degraded' ? ['Source degraded or unavailable.'] : []
    }));
  }).slice(0, 30);
}

function groupEvidenceByQuestion(evidence = [], task = {}) {
  const questions = utils.safeArray(task.researchQuestions).length ? task.researchQuestions : [task.question || task.topic];
  const grouped = {};
  for (const question of questions) {
    grouped[question] = utils.safeArray(evidence)
      .map((item) => ({ ...item, matchScore: utils.textScore(question, `${item.claim} ${item.supportSummary}`) }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }
  return grouped;
}

function detectConflictingEvidence(evidence = []) {
  const text = utils.safeArray(evidence).map((item) => item.claim.toLowerCase()).join('\n');
  const conflicts = [];
  if (/tidak tersedia|unavailable/.test(text) && /tersedia|available|configured/.test(text)) {
    conflicts.push('Availability evidence appears mixed; verify current runtime status.');
  }
  if (/tidak boleh|blocked|denied/.test(text) && /boleh|allowed/.test(text)) {
    conflicts.push('Permission/safety evidence appears conflicting.');
  }
  return conflicts;
}

function detectMissingEvidence(task = {}, evidence = []) {
  const gaps = [];
  if (!utils.safeArray(evidence).length) gaps.push('No evidence extracted from collected sources.');
  const sourceTypes = new Set(utils.safeArray(task.sources).map((source) => source.type));
  for (const required of utils.safeArray(task.sourceRequirements?.requiredTypes)) {
    if (!sourceTypes.has(required)) gaps.push(`Missing required source type: ${required}.`);
  }
  if (task.sourceRequirements?.externalSearchNeeded && !sourceTypes.has('web')) {
    gaps.push('External/current web source not collected; answer must mark live details as unknown.');
  }
  return gaps;
}

async function buildEvidencePack(taskOrId, evidenceInput, services = {}) {
  const task = typeof taskOrId === 'string' ? await planner.getResearchTask(taskOrId, services) : taskOrId;
  if (!task) return { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND', status: 404 };
  const evidence = evidenceInput || extractEvidenceFromSources(task.sources || [], task, services);
  const grouped = groupEvidenceByQuestion(evidence, task, services);
  const conflicts = detectConflictingEvidence(evidence, services);
  const missing = detectMissingEvidence(task, evidence, services);
  const updated = {
    ...task,
    evidence,
    evidencePack: { grouped, conflicts, missing, createdAt: utils.nowIso() },
    gaps: [...new Set([...(task.gaps || []), ...missing, ...conflicts])],
    status: 'analyzing',
    updatedAt: utils.nowIso()
  };
  await store.upsertResearchItem(store.RESEARCH_TASKS_KEY, updated, services);
  await utils.auditResearch('research/evidence_extracted', {
    workspaceId: task.workspaceId,
    userId: task.userId,
    targetId: task.id,
    summary: { evidenceCount: evidence.length, gaps: missing.length, conflicts: conflicts.length }
  }, services);
  return { ok: true, task: updated, evidence, grouped, conflicts, missing };
}

module.exports = {
  buildEvidencePack,
  detectConflictingEvidence,
  detectMissingEvidence,
  extractEvidenceFromSources,
  groupEvidenceByQuestion
};

