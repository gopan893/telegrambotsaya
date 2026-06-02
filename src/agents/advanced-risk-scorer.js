'use strict';

const utils = require('./decision-utils');

function toLevel(score) {
  if (score >= 85) return 'danger';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function scoreSecurityRisk(option = {}, context = {}) {
  const text = `${option.label} ${option.description}`.toLowerCase();
  let score = 10;
  if (/\b(token|secret|api key|authorization|permission|admin|webhook)\b/.test(text)) score += 45;
  if (/\b(restore|import|overwrite|delete|hapus)\b/.test(text)) score += 30;
  if (option.approvalRequired) score += 15;
  return Math.min(100, score);
}

function scoreTechnicalRisk(option = {}, context = {}) {
  const text = `${option.label} ${option.description}`.toLowerCase();
  let score = 12;
  if (/\b(migration|postgres|redis|deploy|render|webhook|external|10 bot|langsung)\b/.test(text)) score += 35;
  if (option.estimatedEffort === 'large') score += 18;
  return Math.min(100, score);
}

function scoreDataRisk(option = {}, context = {}) {
  const text = `${option.label} ${option.description}`.toLowerCase();
  let score = 8;
  if (/\b(restore|import|backup|overwrite|database|delete|hapus|migration)\b/.test(text)) score += 50;
  if (option.reversibility === 'low') score += 20;
  return Math.min(100, score);
}

function scoreOperationalRisk(option = {}, context = {}) {
  const text = `${option.label} ${option.description}`.toLowerCase();
  let score = 10;
  if (/\b(deploy|render|webhook|latency|spam|token management|multi-bot|10 bot)\b/.test(text)) score += 35;
  if (option.estimatedEffort === 'large') score += 15;
  return Math.min(100, score);
}

function scoreScopeRisk(option = {}, context = {}) {
  const text = `${option.label} ${option.description}`.toLowerCase();
  let score = 10;
  if (/\b(10 bot|langsung|semua|besar|full|banyak fitur)\b/.test(text)) score += 45;
  if (/\b(bertahap|4 bot|kecil|stabilisasi)\b/.test(text)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function scoreDecisionRisk(option = {}, context = {}, services = {}) {
  const text = `${option.label || ''} ${option.description || ''}`.toLowerCase();
  const scores = {
    security: scoreSecurityRisk(option, context),
    technical: scoreTechnicalRisk(option, context),
    data: scoreDataRisk(option, context),
    operational: scoreOperationalRisk(option, context),
    scope: scoreScopeRisk(option, context)
  };
  let total = Math.round((scores.security * 1.1 + scores.technical + scores.data * 1.1 + scores.operational + scores.scope) / 5.2);
  if (/\b(restore|import)\b/.test(text) && /\b(langsung|overwrite|database)\b/.test(text)) total = Math.max(total, 86);
  if (/\b(delete|hapus|drop|hard delete)\b/.test(text)) total = Math.max(total, 90);
  return {
    optionId: option.id,
    score: total,
    level: toLevel(total),
    scores,
    approvalRequired: option.approvalRequired || total >= 65,
    summary: utils.sanitizeDecisionText(buildSingleRiskSummary(option, total), { max: 240 })
  };
}

function buildSingleRiskSummary(option = {}, score = 0) {
  const level = toLevel(score);
  if (level === 'danger') return `${option.label} berisiko danger; wajib proposal, preview, approval, dan rollback plan.`;
  if (level === 'high') return `${option.label} berisiko tinggi; perlu Security/Critic review dan approval jika write/external.`;
  if (level === 'medium') return `${option.label} punya risiko sedang; jalankan bertahap dan test.`;
  return `${option.label} relatif low risk jika tetap dibatasi dan reversible.`;
}

function buildRiskSummary(optionRisks = []) {
  const max = optionRisks.reduce((top, item) => Number(item.score || 0) > Number(top.score || 0) ? item : top, { score: 0, level: 'low' });
  return {
    highestRiskLevel: max.level,
    highestRiskOptionId: max.optionId,
    approvalRequired: optionRisks.some(item => item.approvalRequired),
    summary: max.summary || 'Risiko besar tidak terdeteksi.'
  };
}

function recommendRiskMitigations(optionRisks = []) {
  const mitigations = ['Mulai dari langkah kecil dan reversible.', 'Jalankan regression test sebelum deploy.'];
  if (optionRisks.some(item => ['high', 'danger'].includes(item.level))) {
    mitigations.unshift('Buat executor/restore proposal dan minta approval eksplisit sebelum action.');
    mitigations.push('Cek audit log, permission, integrity/checksum, dan rollback path.');
  }
  return utils.unique(mitigations).slice(0, 6);
}

module.exports = {
  buildRiskSummary,
  recommendRiskMitigations,
  scoreDataRisk,
  scoreDecisionRisk,
  scoreOperationalRisk,
  scoreScopeRisk,
  scoreSecurityRisk,
  scoreTechnicalRisk
};
