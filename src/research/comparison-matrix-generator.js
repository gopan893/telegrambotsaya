'use strict';

const utils = require('./research-utils');

const DIMENSIONS = ['quality', 'latency', 'cost', 'privacy', 'reliability', 'integration_difficulty', 'maintenance', 'safety', 'local_support', 'cloud_support'];

function generateComparisonMatrix(input = {}, services = {}) {
  const { options } = input;
  if (!options || !options.length) return { matrix: [], summary: 'Tidak ada opsi untuk dibandingkan.' };
  const matrix = options.map(opt => ({
    name: utils.sanitizeText(opt.name || 'Unknown', 100),
    dimensions: DIMENSIONS.map(dim => ({
      dimension: dim,
      score: opt[dim] ?? 3,
      label: scoreLabel(opt[dim])
    }))
  }));
  const summary = matrix.map(m => `${m.name}: rata-rata ${(m.dimensions.reduce((s, d) => s + d.score, 0) / m.dimensions.length).toFixed(1)}/5`).join('\n');
  return { matrix, dimensions: DIMENSIONS, summary };
}

function compareApiOptions(options = [], services = {}) {
  return generateComparisonMatrix({ options: options.map(o => ({ ...o, ...inferApiScores(o) })) }, services);
}

function compareModelOptions(options = [], services = {}) {
  return generateComparisonMatrix({ options: options.map(o => ({ ...o, ...inferModelScores(o) })) }, services);
}

function compareDeploymentOptions(options = [], services = {}) {
  return generateComparisonMatrix({ options: options.map(o => ({ ...o, ...inferDeployScores(o) })) }, services);
}

function compareCostPrivacyQuality(options = [], services = {}) {
  return generateComparisonMatrix({ options: options.map(o => ({ ...o, ...inferCostPrivacyQualityScores(o) })) }, services);
}

function inferApiScores(opt = {}) {
  return { integration_difficulty: opt.easeOfUse ? 4 : 3, reliability: 3, safety: 3, local_support: 1, cloud_support: 5 };
}

function inferModelScores(opt = {}) {
  const n = String(opt.name || '').toLowerCase();
  const local = /ollama|local|llama/i.test(n) ? 5 : /openai|gemini/i.test(n) ? 1 : 2;
  const cloud = /openai|gemini|mistral|groq/i.test(n) ? 5 : 2;
  const privacy = local >= 4 ? 5 : 2;
  return { local_support: local, cloud_support: cloud, privacy, quality: opt.quality || 3, cost: opt.cost || 3 };
}

function inferDeployScores(opt = {}) {
  return { maintenance: 3, reliability: 3, safety: 3, integration_difficulty: 3, local_support: opt.local ? 4 : 1, cloud_support: opt.cloud ? 5 : 1 };
}

function inferCostPrivacyQualityScores(opt = {}) {
  return { cost: opt.cost || 3, privacy: opt.privacy || 3, quality: opt.quality || 3 };
}

function scoreLabel(val) {
  if (val >= 5) return 'excellent';
  if (val >= 4) return 'good';
  if (val >= 3) return 'fair';
  if (val >= 2) return 'poor';
  return 'bad';
}

module.exports = { generateComparisonMatrix, compareApiOptions, compareModelOptions, compareDeploymentOptions, compareCostPrivacyQuality, DIMENSIONS };
