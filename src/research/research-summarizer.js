'use strict';

const evidenceExtractor = require('./evidence-extractor');
const freshness = require('./research-freshness-checker');
const gapDetector = require('./research-gap-detector');
const store = require('./research-store');
const planner = require('./research-task-planner');
const utils = require('./research-utils');

function confidenceFromEvidence(evidence = []) {
  if (!utils.safeArray(evidence).length) return 0.25;
  const avg = evidence.reduce((sum, item) => sum + Number(item.confidence || 0.5), 0) / evidence.length;
  const diversity = new Set(evidence.map((item) => item.sourceId)).size;
  return Number(Math.min(0.95, avg * 0.78 + Math.min(diversity, 4) * 0.04).toFixed(2));
}

function createEvidenceGroundedAnswerFromTask(task = {}) {
  const evidence = utils.safeArray(task.evidence);
  const topEvidence = evidence
    .slice()
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 6);
  const facts = topEvidence.map((item) => utils.sanitizeText(item.claim, 220));
  const gaps = utils.safeArray(task.gaps);
  const confidence = confidenceFromEvidence(evidence);
  const recommendation = facts.length
    ? `Gunakan temuan yang didukung evidence dan tandai bagian yang belum diverifikasi. Untuk "${task.topic}", rekomendasi awal: ${facts[0]}`
    : 'Belum cukup evidence untuk rekomendasi pasti.';
  return {
    taskId: task.id,
    topic: task.topic,
    answerSummary: facts.length ? facts.slice(0, 3).join(' ') : 'Belum ada fakta terverifikasi dari sumber yang tersedia.',
    facts,
    assumptions: gaps.length ? ['Beberapa detail belum diverifikasi dan harus dianggap asumsi.'] : [],
    unknowns: gaps,
    recommendations: [recommendation, ...gapDetector.suggestNextResearchSteps(task, gaps).slice(0, 3)],
    evidenceUsed: topEvidence.map((item) => ({
      sourceId: item.sourceId,
      claim: item.claim,
      confidence: item.confidence,
      limitations: item.limitations || []
    })),
    confidence,
    freshnessWarning: freshness.buildFreshnessWarning(task),
    sourceLimitations: utils.safeArray(task.sources).filter((source) => source.status !== 'collected').map((source) => source.summary).slice(0, 5)
  };
}

async function summarizeResearchTask(taskId, services = {}) {
  let task = await planner.getResearchTask(taskId, services);
  if (!task) return { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND', status: 404 };
  if (!utils.safeArray(task.evidence).length) {
    const pack = await evidenceExtractor.buildEvidencePack(task, null, services);
    if (pack.ok) task = pack.task;
  }
  const summary = createEvidenceGroundedAnswerFromTask(task);
  const unsupported = gapDetector.detectUnsupportedClaims(summary, task.evidence);
  const updated = {
    ...task,
    findings: summary.facts.map((fact, index) => ({
      id: utils.createId('finding'),
      summary: fact,
      confidence: summary.evidenceUsed[index]?.confidence || summary.confidence,
      retrievedAt: utils.nowIso()
    })),
    gaps: [...new Set([...(task.gaps || []), ...unsupported])],
    summary,
    status: 'summarized',
    updatedAt: utils.nowIso()
  };
  await store.upsertResearchItem(store.RESEARCH_TASKS_KEY, updated, services);
  await store.appendResearchItem(store.RESEARCH_REPORTS_KEY, { id: utils.createId('research_report'), taskId, summary, createdAt: utils.nowIso() }, 1000, services);
  await utils.auditResearch('research/summarized', {
    workspaceId: task.workspaceId,
    userId: task.userId,
    targetId: task.id,
    summary: { confidence: summary.confidence, evidenceUsed: summary.evidenceUsed.length, gaps: updated.gaps.length }
  }, services);
  return { ok: true, task: updated, summary };
}

async function createEvidenceGroundedAnswer(taskId, services = {}) {
  const result = await summarizeResearchTask(taskId, services);
  return result.ok ? { ok: true, answer: result.summary } : result;
}

async function createResearchBrief(taskId, services = {}) {
  const result = await summarizeResearchTask(taskId, services);
  if (!result.ok) return result;
  const s = result.summary;
  const text = [
    `Research Brief: ${s.topic}`,
    '',
    'Facts:',
    ...(s.facts.length ? s.facts.map((item) => `- ${item}`) : ['- Unknown; evidence belum cukup.']),
    '',
    'Assumptions/Unknowns:',
    ...(s.unknowns.length ? s.unknowns.map((item) => `- ${item}`) : ['- Tidak ada gap besar dari sumber lokal.']),
    '',
    'Recommendations:',
    ...s.recommendations.map((item) => `- ${item}`),
    '',
    `Confidence: ${s.confidence}`
  ].join('\n');
  return { ok: true, brief: { ...s, text } };
}

async function createProsConsFromEvidence(taskId, services = {}) {
  const result = await summarizeResearchTask(taskId, services);
  if (!result.ok) return result;
  return {
    ok: true,
    pros: result.summary.facts.slice(0, 4),
    cons: result.summary.unknowns.slice(0, 4),
    confidence: result.summary.confidence
  };
}

async function createRecommendationFromEvidence(taskId, services = {}) {
  const result = await summarizeResearchTask(taskId, services);
  if (!result.ok) return result;
  return {
    ok: true,
    recommendation: result.summary.recommendations[0],
    confidence: result.summary.confidence,
    unknowns: result.summary.unknowns
  };
}

module.exports = {
  createEvidenceGroundedAnswer,
  createEvidenceGroundedAnswerFromTask,
  createProsConsFromEvidence,
  createRecommendationFromEvidence,
  createResearchBrief,
  summarizeResearchTask
};

