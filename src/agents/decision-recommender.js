'use strict';

const riskScorer = require('./advanced-risk-scorer');
const confidenceScorer = require('./confidence-scorer');
const utils = require('./decision-utils');

function optionScore(option = {}, criteria = [], risks = []) {
  const risk = risks.find(item => item.optionId === option.id) || {};
  let score = 50;
  if (option.expectedBenefit === 'high') score += 18;
  if (option.estimatedEffort === 'small') score += 12;
  if (option.estimatedEffort === 'large') score -= 12;
  if (option.reversibility === 'high') score += 14;
  if (option.reversibility === 'low') score -= 14;
  if (option.approvalRequired) score -= 12;
  score -= Math.round(Number(risk.score || 0) * 0.35);
  const label = String(option.label || '').toLowerCase();
  if (/\b(bertahap|4 bot|restore plan|validasi|checksum|integrity|approval|postgresql \+ json|stabilisasi)\b/.test(label)) score += 18;
  if (/\b(restore langsung|10 bot langsung|overwrite|delete|hapus)\b/.test(label)) score -= 25;
  return Math.max(0, Math.min(100, score));
}

function rankOptions(options = [], criteria = [], risks = [], prosCons = [], tradeoffs = {}, confidence = {}) {
  return options
    .map(option => ({ ...option, score: optionScore(option, criteria, risks) }))
    .sort((a, b) => b.score - a.score);
}

function buildRecommendationReasoningSummary(decision = {}) {
  const rec = decision.recommendation || {};
  const recommended = (decision.options || []).find(option => option.id === rec.recommendedOptionId);
  const riskSummary = riskScorer.buildRiskSummary(decision.risks || []);
  const reasons = [
    recommended ? `${recommended.label} punya kombinasi paling baik antara safety, effort, reversibility, dan value.` : '',
    riskSummary.approvalRequired ? 'Ada risiko write/external/danger sehingga approval eksplisit tetap wajib.' : '',
    decision.confidence?.level ? `Confidence ${decision.confidence.level}.` : ''
  ].filter(Boolean);
  return reasons.map(item => utils.sanitizeDecisionText(item, { max: 220 }));
}

function buildNextStepsForRecommendation(decision = {}) {
  const rec = decision.recommendation || {};
  const option = (decision.options || []).find(item => item.id === rec.recommendedOptionId) || {};
  const label = String(option.label || rec.recommendation || '').toLowerCase();
  if (/restore|import|backup/.test(label)) {
    return [
      'Buat restore/import plan, bukan direct restore.',
      'Validasi checksum, integrity, dan diff preview.',
      'Minta approval owner/admin.',
      'Run hanya setelah preview aman.'
    ];
  }
  if (/postgres/.test(label)) {
    return [
      'Pastikan PostgreSQL aktif sebagai primary storage.',
      'Jaga JSON fallback tetap tersedia.',
      'Jalankan migration/status check.',
      'Test command dan dashboard yang membaca storage.'
    ];
  }
  if (/4 bot|bertahap|multi-bot/.test(label)) {
    return [
      'Mulai dari Orchestrator, Planner, Coder, dan Critic.',
      'Test router, visible replies, dan anti-spam.',
      'Tambahkan agent lain setelah stabil.',
      'Pantau audit/log dan latency.'
    ];
  }
  if (/phase/.test(decision.question || '') || /phase/.test(label)) {
    return [
      'Tutup test/regression phase sebelumnya.',
      'Batasi scope phase berikutnya agar kecil.',
      'Implement module foundation dulu.',
      'Dokumentasi dan manual test setelah deploy.'
    ];
  }
  if (/istirahat|capek|lelah/.test(label)) {
    return [
      'Ambil jeda singkat dulu.',
      'Pilih satu task kecil setelah energi cukup.',
      'Hindari keputusan besar saat lelah.'
    ];
  }
  return [
    'Ambil langkah kecil yang reversible.',
    'Catat asumsi dan risiko.',
    'Jalankan test sederhana.',
    'Review hasil sebelum ekspansi.'
  ];
}

function buildApprovalRequirement(decision = {}) {
  const riskSummary = riskScorer.buildRiskSummary(decision.risks || []);
  const approvalRequired = Boolean(decision.approvalRequired || riskSummary.approvalRequired);
  return {
    approvalRequired,
    shouldCreateExecutorProposal: approvalRequired,
    reason: approvalRequired
      ? 'Keputusan menyentuh write/external/danger action sehingga perlu proposal dan approval eksplisit.'
      : 'Tidak ada action berisiko yang perlu approval pada tahap analisis.'
  };
}

function buildFallbackRecommendation(decision = {}) {
  return {
    recommendedOptionId: decision.options?.[0]?.id || '',
    recommendation: 'Pilih langkah paling kecil, reversible, dan mudah dites.',
    confidence: decision.confidence || { score: 0.45, level: 'medium', reasons: ['Fallback rule-based recommendation.'] },
    reasons: ['Konteks belum cukup kuat untuk rekomendasi yang agresif.'],
    risks: riskScorer.buildRiskSummary(decision.risks || []),
    mitigations: riskScorer.recommendRiskMitigations(decision.risks || []),
    nextSteps: buildNextStepsForRecommendation(decision),
    approvalRequired: Boolean(decision.approvalRequired),
    shouldCreateExecutorProposal: Boolean(decision.approvalRequired)
  };
}

function recommendOption(decision = {}, services = {}) {
  const ranked = rankOptions(decision.options || [], decision.criteria || [], decision.risks || [], decision.prosCons || [], decision.tradeoffs || {}, decision.confidence || {});
  if (!ranked.length) return buildFallbackRecommendation(decision);
  const best = ranked[0];
  const highRisk = (decision.risks || []).find(item => item.optionId === best.id);
  const approval = buildApprovalRequirement({ ...decision, options: ranked });
  const confidence = decision.confidence || confidenceScorer.scoreDecisionConfidence(decision, ranked, decision.risks || [], {}, services);
  const recommendation = utils.sanitizeDecisionText(buildRecommendationText(best, decision, highRisk), { max: 400 });
  const output = {
    recommendedOptionId: best.id,
    recommendation,
    confidence,
    reasons: buildRecommendationReasoningSummary({ ...decision, options: ranked, recommendation: { recommendedOptionId: best.id } }),
    risks: riskScorer.buildRiskSummary(decision.risks || []),
    mitigations: riskScorer.recommendRiskMitigations(decision.risks || []),
    nextSteps: buildNextStepsForRecommendation({ ...decision, options: ranked, recommendation: { recommendedOptionId: best.id } }),
    approvalRequired: approval.approvalRequired,
    shouldCreateExecutorProposal: approval.shouldCreateExecutorProposal
  };
  return utils.sanitizeDecisionPayload(output);
}

function buildRecommendationText(option = {}, decision = {}, risk = {}) {
  const q = String(decision.question || '').toLowerCase();
  const label = option.label || 'opsi paling aman';
  if (/10 bot|4 bot/.test(q)) return `Mulai dari 4 bot inti dulu, lalu tambah agent lain bertahap setelah routing dan anti-spam stabil.`;
  if (/restore|import/.test(q)) return `Jangan restore/import langsung. Pilih jalur restore plan + integrity/checksum + approval.`;
  if (/postgres|json/.test(q)) return `Untuk production, pilih PostgreSQL sebagai primary storage dengan JSON sebagai fallback compatibility.`;
  if (/lanjut phase|phase berapa|roadmap/.test(q)) return `Jika Phase 23 sudah selesai, lanjut Phase 24 — Agent Decision System + Advanced Risk Review.`;
  if (/capek|lelah|istirahat|coding/.test(q)) return `Pilih langkah rendah tekanan: istirahat singkat dulu atau task kecil maksimal 30 menit, bukan coding berat.`;
  if (risk?.level === 'danger') return `Pilih opsi yang tidak menjalankan aksi langsung: ${label}.`;
  return `Saya merekomendasikan: ${label}.`;
}

module.exports = {
  buildApprovalRequirement,
  buildFallbackRecommendation,
  buildNextStepsForRecommendation,
  buildRecommendationReasoningSummary,
  rankOptions,
  recommendOption
};
