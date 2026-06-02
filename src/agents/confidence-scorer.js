'use strict';

const utils = require('./decision-utils');

function detectLowInformationDecision(decision = {}) {
  const reasons = [];
  if (!decision.options || decision.options.length < 2) reasons.push('Opsi belum cukup jelas.');
  if (!decision.contextSummary || decision.contextSummary.length < 40) reasons.push('Konteks keputusan masih pendek.');
  if ((decision.prosCons || []).some(item => (item.unknowns || []).length)) reasons.push('Ada unknowns/assumptions yang belum divalidasi.');
  return { lowInformation: reasons.length > 0, reasons };
}

function detectContradictorySignals(decision = {}) {
  const text = JSON.stringify(decision || {}).toLowerCase();
  const hasFast = /\b(cepat|langsung|fast|speed)\b/.test(text);
  const hasSafe = /\b(aman|safety|approval|bertahap|reversible)\b/.test(text);
  const hasDanger = /\b(danger|restore langsung|overwrite|delete)\b/.test(text);
  const contradictions = [];
  if (hasFast && hasDanger) contradictions.push('Kecepatan bertabrakan dengan risiko danger.');
  if (hasFast && hasSafe) contradictions.push('Ada trade-off speed vs safety.');
  return { contradictory: contradictions.length > 0, contradictions };
}

function detectHighUncertainty(decision = {}) {
  const lowInfo = detectLowInformationDecision(decision);
  const highRisk = (decision.risks || []).some(item => ['high', 'danger'].includes(item.level));
  return {
    highUncertainty: lowInfo.lowInformation || highRisk,
    reasons: [...lowInfo.reasons, highRisk ? 'Keputusan melibatkan risiko tinggi.' : ''].filter(Boolean)
  };
}

function buildConfidenceExplanation(score = 0.5, reasons = []) {
  const level = score >= 0.72 ? 'high' : (score >= 0.45 ? 'medium' : 'low');
  const fallback = {
    high: 'Confidence tinggi karena opsi dan konteks cukup jelas.',
    medium: 'Confidence medium karena keputusan cukup reversible, tetapi masih ada asumsi.',
    low: 'Confidence rendah karena konteks atau bukti belum cukup.'
  };
  return {
    score: Number(score.toFixed(2)),
    level,
    reasons: reasons.length ? reasons.map(item => utils.sanitizeDecisionText(item, { max: 180 })) : [fallback[level]]
  };
}

function scoreDecisionConfidence(decision = {}, options = [], risks = [], context = {}, services = {}) {
  let score = 0.62;
  const reasons = [];
  if (options.length >= 2) {
    score += 0.08;
    reasons.push('Ada lebih dari satu opsi untuk dibandingkan.');
  }
  if (options.some(option => option.reversibility === 'high')) {
    score += 0.08;
    reasons.push('Ada opsi yang reversible/bertahap.');
  }
  if (risks.some(item => ['high', 'danger'].includes(item.level))) {
    score -= 0.18;
    reasons.push('Ada risiko tinggi/danger sehingga confidence diturunkan.');
  }
  const lowInfo = detectLowInformationDecision({ ...decision, options });
  if (lowInfo.lowInformation) {
    score -= options.length < 2 ? 0.32 : 0.15;
    reasons.push(...lowInfo.reasons);
  }
  const contradictions = detectContradictorySignals(decision);
  if (contradictions.contradictory) {
    score -= 0.08;
    reasons.push(...contradictions.contradictions);
  }
  score = Math.max(0.2, Math.min(0.9, score));
  return buildConfidenceExplanation(score, reasons);
}

module.exports = {
  buildConfidenceExplanation,
  detectContradictorySignals,
  detectHighUncertainty,
  detectLowInformationDecision,
  scoreDecisionConfidence
};
