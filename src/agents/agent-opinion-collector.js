'use strict';

const agentRegistry = require('./agent-registry');
const promptComposer = require('./agent-prompt-composer');
const {
  createCouncilId,
  inferRiskLevel,
  isDangerousActionText,
  isDecisionText,
  isPlanningText,
  nowIso,
  sanitizeCouncilPayload,
  sanitizeCouncilText
} = require('./council-utils');

function stanceForAgent(agentId, session = {}) {
  if (agentId === 'critic') return 'risk';
  if (agentId === 'security') return session.approvalRequired ? 'risk' : 'neutral';
  if (agentId === 'planner') return 'support';
  if (agentId === 'executor') return 'alternative';
  if (agentId === 'orchestrator') return 'summary';
  return 'neutral';
}

function recommendationForAgent(agentId, session = {}) {
  const text = `${session.topic || ''} ${session.originalMessage || ''}`;
  if (agentId === 'planner') {
    if (/phase|tahap|lanjut/i.test(text)) return 'Lanjut ke Phase 22 dengan scope kecil: council/debate internal dan synthesis final.';
    if (/10 bot|4 dulu|langsung/i.test(text)) return 'Mulai dari 4 bot inti dulu, lalu tambah agent lain setelah routing stabil.';
    return 'Pilih satu outcome terdekat, pecah menjadi 2-4 langkah, lalu review risiko.';
  }
  if (agentId === 'coder') return 'Jaga implementasi kecil, CommonJS, tanpa dependency berat, dan verifikasi dengan scratch tests.';
  if (agentId === 'critic') return 'Waspadai scope creep, debat terlalu panjang, dan agent terlalu banyak bicara di normal chat.';
  if (agentId === 'security') return session.approvalRequired
    ? 'Jangan jalankan restore/import/write action tanpa proposal, checksum/integrity check, dan approval eksplisit.'
    : 'Tetap redaksi token/secret dan jangan simpan credential ke memory/council.';
  if (agentId === 'ops') return 'Cek Render logs, webhook, active storage driver, Redis fallback, dan health endpoint sebelum menambah fitur.';
  if (agentId === 'executor') return 'Jika user meminta aksi, buat proposal saja. Approval dan run tetap terpisah.';
  if (agentId === 'research') return 'Jika keputusan bergantung info terbaru, jalankan search aman dan pisahkan fakta dari asumsi.';
  if (agentId === 'memory') return 'Gunakan memory/graph yang relevan saja; jangan dump semua konteks.';
  if (agentId === 'reflection') return 'Beri satu langkah kecil dan hindari beban teknis berlebihan.';
  return 'Satukan masukan agent lain menjadi jawaban final yang ringkas.';
}

function concernForAgent(agentId, session = {}) {
  if (agentId === 'critic') return ['Scope terlalu melebar.', 'Asumsi belum diuji.', 'Output bisa terlalu panjang.'];
  if (agentId === 'security') return session.approvalRequired
    ? ['Aksi berisiko butuh approval eksplisit.', 'Jangan expose secret atau credential.']
    : ['Pastikan audit tetap sanitized.'];
  if (agentId === 'coder') return ['Risiko regresi command lama.', 'Integrasi dashboard jangan memecah PWA/backup.'];
  if (agentId === 'ops') return ['Render free tier sensitif pada latency dan background loop.', 'Storage fallback harus tetap aman.'];
  if (agentId === 'planner') return ['Prioritas harus dibatasi agar selesai.'];
  return [];
}

async function composeOpinionPrompt(agentId, session = {}, services = {}) {
  try {
    const composed = await promptComposer.composeAgentFinalPrompt(agentId, session.originalMessage || session.topic || '', {
      workspaceId: session.workspaceId,
      userId: session.userId,
      topics: session.topics || [],
      riskLevel: session.riskLevel,
      mode: session.mode
    }, services);
    return composed.promptPreview || '';
  } catch (_) {
    return '';
  }
}

function parseAgentOpinion(rawOutput = '', agentId, session = {}) {
  return sanitizeOpinion({
    agentId,
    sessionId: session.id,
    summary: rawOutput || recommendationForAgent(agentId, session)
  }, session);
}

function sanitizeOpinion(opinion = {}, session = {}) {
  return sanitizeCouncilPayload({
    id: opinion.id || createCouncilId('opinion'),
    sessionId: opinion.sessionId || session.id || '',
    agentId: opinion.agentId || 'orchestrator',
    role: opinion.role || agentRegistry.getAgent(opinion.agentId || 'orchestrator')?.role || 'agent',
    stance: opinion.stance || stanceForAgent(opinion.agentId || 'orchestrator', session),
    confidence: Number(opinion.confidence || 0.72),
    riskLevel: inferRiskLevel(opinion.riskLevel || session.riskLevel || 'low'),
    summary: sanitizeCouncilText(opinion.summary || recommendationForAgent(opinion.agentId, session), 700),
    reasoningSummary: sanitizeCouncilText(opinion.reasoningSummary || 'Ringkasan alasan disajikan secara singkat tanpa hidden chain-of-thought.', 320),
    recommendations: (opinion.recommendations || [recommendationForAgent(opinion.agentId, session)]).slice(0, 5).map(item => sanitizeCouncilText(item, 260)),
    concerns: (opinion.concerns || concernForAgent(opinion.agentId, session)).slice(0, 5).map(item => sanitizeCouncilText(item, 220)),
    requiresApproval: Boolean(opinion.requiresApproval || session.approvalRequired || isDangerousActionText(session.originalMessage || '')),
    createdAt: opinion.createdAt || nowIso()
  });
}

function fallbackOpinion(agentId, session = {}, error) {
  return sanitizeOpinion({
    agentId,
    sessionId: session.id,
    summary: recommendationForAgent(agentId, session),
    reasoningSummary: error ? `Fallback opinion dipakai karena collector error: ${sanitizeCouncilText(error.message || error, 120)}` : undefined,
    confidence: 0.58,
    requiresApproval: session.approvalRequired
  }, session);
}

async function collectOpinionFromAgent(agentId, session = {}, services = {}) {
  try {
    const promptPreview = await composeOpinionPrompt(agentId, session, services);
    const text = `${session.topic || ''} ${session.originalMessage || ''}`;
    const summary = recommendationForAgent(agentId, session);
    const confidence = isPlanningText(text) || isDecisionText(text) ? 0.76 : 0.66;
    return sanitizeOpinion({
      agentId,
      sessionId: session.id,
      summary,
      confidence,
      reasoningSummary: promptPreview ? 'Opini memakai profile/memory agent yang relevan dan diringkas aman.' : undefined,
      requiresApproval: session.approvalRequired
    }, session);
  } catch (err) {
    return fallbackOpinion(agentId, session, err);
  }
}

module.exports = {
  collectOpinionFromAgent,
  composeOpinionPrompt,
  fallbackOpinion,
  parseAgentOpinion,
  sanitizeOpinion
};
