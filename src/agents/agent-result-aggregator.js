'use strict';

const conflictDetector = require('./agent-conflict-detector');
const store = require('./agent-task-store');
const utils = require('./delegation-utils');

async function aggregateTaskResults(delegationId, services = {}) {
  const session = await store.getDelegation(delegationId, services);
  if (!session) throw new Error('DELEGATION_NOT_FOUND');
  const results = await store.listTaskResults({ delegationId, limit: 50 }, services);
  const conflicts = conflictDetector.detectConflictingResults(results);
  const lowConfidence = conflictDetector.detectLowConfidenceResults(results);
  const missingCoverage = conflictDetector.detectMissingAgentCoverage(session, results);
  const finalAnswer = buildFinalDelegationAnswer(session, results, { conflicts, lowConfidence, missingCoverage }, services);
  const actionRecommendations = buildActionRecommendations(results, services);
  const confidence = buildConfidenceScore(results, services);
  return utils.sanitizeDelegationPayload({
    session,
    results,
    conflicts,
    lowConfidence,
    missingCoverage,
    finalAnswer,
    actionRecommendations,
    nextSteps: buildNextSteps(results, services),
    confidence
  });
}

function summarizeAgentResults(results = [], services = {}) {
  if (!results.length) return 'Belum ada hasil task agent.';
  return results.slice(0, 6).map(item => {
    const agent = item.agentId || item.result?.agentId || 'agent';
    const summary = item.resultSummary || item.result?.summary || '-';
    return `${agent}: ${utils.sanitizeDelegationText(summary, { max: 260 })}`;
  });
}

function buildActionRecommendations(results = [], services = {}) {
  const items = [];
  for (const item of results) {
    const proposal = item.result?.proposalRecommendation;
    if (proposal) items.push(proposal);
    for (const rec of item.result?.recommendations || []) items.push(rec);
  }
  return utils.unique(items).slice(0, 6).map(text => utils.sanitizeDelegationText(text, { max: 220 }));
}

function buildNextSteps(results = [], services = {}) {
  const recommendations = buildActionRecommendations(results, services);
  if (recommendations.length) return recommendations.slice(0, 5);
  return [
    'Pilih satu langkah terkecil yang bisa divalidasi.',
    'Jalankan test/regression yang relevan.',
    'Catat risiko dan keputusan penting.'
  ];
}

function buildConfidenceScore(results = [], services = {}) {
  if (!results.length) return 0.45;
  const avg = results.reduce((sum, item) => sum + Number(item.confidence || item.result?.confidence || 0.6), 0) / results.length;
  return Math.max(0.25, Math.min(0.9, avg));
}

function buildFinalDelegationAnswer(session = {}, results = [], analysis = {}, services = {}) {
  const summaries = summarizeAgentResults(results, services);
  const nextSteps = buildNextSteps(results, services);
  const conflictSummary = conflictDetector.buildConflictSummary(analysis.conflicts || []);
  const approvalRequired = Boolean(session.approvalRequired || results.some(item => item.result?.proposalRecommendation));
  const goal = session.goal || session.originalMessageSummary || 'request ini';
  const lines = [
    `Saya pecah request ini menjadi beberapa sudut pandang agent dan menggabungkannya.`,
    '',
    `Rekomendasi: ${buildPrimaryRecommendation(session, results)}`,
    '',
    'Ringkasan agent:',
    ...(summaries.length ? summaries.slice(0, 5).map(item => `- ${item}`) : ['- Belum ada hasil agent.']),
    '',
    'Langkah berikutnya:',
    ...nextSteps.slice(0, 5).map((step, index) => `${index + 1}. ${step}`),
    (analysis.conflicts || []).length ? `\nCatatan konflik: ${conflictSummary}` : '',
    approvalRequired ? '\nCatatan: write/external/danger action tetap harus lewat executor proposal dan approval eksplisit.' : ''
  ];
  return utils.sanitizeDelegationText(lines.filter(Boolean).join('\n'), { userText: goal, max: 2200 });
}

function buildPrimaryRecommendation(session = {}, results = []) {
  const text = `${session.goal || ''} ${session.originalMessageSummary || ''}`.toLowerCase();
  if (/phase\s*24|external integration|integrasi eksternal/.test(text)) return 'mulai dari scope Phase 24 yang kecil: integrasi eksternal aman, approval boundary, dan test regressions.';
  if (/deploy|render|error|crash/.test(text)) return 'mulai dari diagnosis Ops + Coder: cek health/log/webhook/storage, lalu isolasi perubahan terakhir.';
  if (/restore|import|backup/.test(text)) return 'jangan restore langsung; buat restore plan, cek integrity/checksum, lalu approval owner/admin.';
  const first = results.find(item => item.result?.recommendations?.length);
  return first?.result?.recommendations?.[0] || 'ambil opsi bertahap dengan risiko terkecil dan validasi cepat.';
}

module.exports = {
  aggregateTaskResults,
  buildActionRecommendations,
  buildConfidenceScore,
  buildFinalDelegationAnswer,
  buildNextSteps,
  summarizeAgentResults
};
