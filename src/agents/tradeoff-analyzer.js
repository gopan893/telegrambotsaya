'use strict';

const utils = require('./decision-utils');

function compareOptions(optionA = {}, optionB = {}, context = {}) {
  return {
    a: optionA.id,
    b: optionB.id,
    summary: utils.sanitizeDecisionText(`${optionA.label} cenderung ${describeOption(optionA)}, sedangkan ${optionB.label} cenderung ${describeOption(optionB)}.`, { max: 260 })
  };
}

function describeOption(option = {}) {
  const parts = [];
  if (option.estimatedEffort === 'small') parts.push('lebih cepat');
  if (option.estimatedEffort === 'large') parts.push('lebih berat');
  if (['high', 'danger'].includes(option.estimatedRisk)) parts.push('lebih berisiko');
  if (option.reversibility === 'high') parts.push('lebih mudah di-rollback');
  if (option.expectedBenefit === 'high') parts.push('bernilai tinggi');
  return parts.join(', ') || 'seimbang';
}

function buildTradeoffMatrix(options = [], criteria = []) {
  return options.map(option => ({
    optionId: option.id,
    safety: ['low', 'medium'].includes(option.estimatedRisk) ? 'good' : 'weak',
    effort: option.estimatedEffort,
    stability: option.reversibility === 'high' ? 'good' : 'needs_review',
    speed: option.estimatedEffort === 'small' ? 'fast' : 'slower',
    reversibility: option.reversibility,
    value: option.expectedBenefit
  }));
}

function detectDominantOption(options = []) {
  const sorted = [...options].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  if (sorted.length < 2) return sorted[0] || null;
  return Number(sorted[0].score || 0) - Number(sorted[1].score || 0) >= 15 ? sorted[0] : null;
}

function detectNoClearWinner(options = []) {
  return !detectDominantOption(options);
}

function buildTradeoffSummary(analysis = {}) {
  if (analysis.dominantOption) return `Opsi paling kuat: ${analysis.dominantOption.label}.`;
  return 'Tidak ada pemenang mutlak; pilih opsi paling reversible dan paling aman untuk langkah pertama.';
}

function analyzeTradeoffs(options = [], criteria = [], prosCons = [], risks = [], services = {}) {
  const comparisons = [];
  for (let i = 0; i < options.length - 1; i += 1) {
    comparisons.push(compareOptions(options[i], options[i + 1], {}));
  }
  const dominantOption = detectDominantOption(options);
  const analysis = {
    matrix: buildTradeoffMatrix(options, criteria),
    comparisons,
    dominantOption,
    noClearWinner: !dominantOption,
    keyTradeoffs: [
      'speed vs safety',
      'scope/features vs maintainability',
      'autonomy vs human approval',
      'short-term progress vs long-term stability'
    ]
  };
  return {
    ...analysis,
    summary: buildTradeoffSummary(analysis)
  };
}

module.exports = {
  analyzeTradeoffs,
  buildTradeoffMatrix,
  buildTradeoffSummary,
  compareOptions,
  detectDominantOption,
  detectNoClearWinner
};
