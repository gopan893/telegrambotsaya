'use strict';

const store = require('./model-router-store');
const utils = require('./model-router-utils');

const SMOKE_TEST_PROMPTS = [
  'Say hello in one word.',
  'What is 2+2? Answer with just the number.',
  'Is the sky blue? Answer yes or no.'
];

async function runSafeModelBenchmark(scope = 'smoke', services = {}) {
  if (scope === 'smoke') {
    return await runSmokeBenchmark(services);
  }
  return { error: 'Non-smoke benchmark requires approval.', requiresApproval: true };
}

async function runSmokeBenchmark(services = {}) {
  const results = [];
  const s = await store.loadModelStore(services);
  for (const p of s.providers) {
    if (p.type === 'fallback') continue;
    results.push({ providerId: p.id, provider: p.name, status: 'simulated', note: 'Smoke benchmark simulated — no real API call.', latencyMs: Math.round(Math.random() * 500 + 100) });
  }
  return { scope: 'smoke', results, summary: `Benchmark selesai untuk ${results.length} provider (simulasi).` };
}

async function benchmarkModelLatency(providerId, services = {}) {
  return { providerId, latencyMs: Math.round(Math.random() * 500 + 100), simulated: true };
}

async function benchmarkModelQualitySmoke(providerId, services = {}) {
  return { providerId, qualityScore: Math.round(Math.random() * 20 + 75), simulated: true };
}

async function benchmarkModelJsonReliability(providerId, services = {}) {
  return { providerId, jsonReliability: Math.round(Math.random() * 10 + 85), simulated: true };
}

function buildBenchmarkReport(results = {}, services = {}) {
  return {
    scope: results.scope || 'unknown',
    providerCount: results.results?.length || 0,
    summary: results.summary || 'No benchmark data.',
    results: results.results || []
  };
}

module.exports = { runSafeModelBenchmark, benchmarkModelLatency, benchmarkModelQualitySmoke, benchmarkModelJsonReliability, buildBenchmarkReport };
