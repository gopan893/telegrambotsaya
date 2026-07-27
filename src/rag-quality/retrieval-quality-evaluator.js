'use strict';

const { clamp, average } = require('./rag-quality-utils');
const confidenceScorer = require('./source-confidence-scorer');
const freshnessScorer = require('./source-freshness-scorer');
const store = require('./rag-quality-store');

function evaluateRetrievalQuality(results, query) {
  if (!Array.isArray(results) || results.length === 0) {
    return createEmptyEvaluation(query);
  }

  const relevanceScore = evaluateRelevance(results, query);
  const freshnessScore = evaluateFreshness(results);
  const diversityScore = evaluateDiversity(results);
  const trustScore = evaluateTrust(results);
  const sensitivityScore = evaluateSensitivity(results);

  const overall = average([
    relevanceScore.score * 0.35,
    freshnessScore.score * 0.15,
    diversityScore.score * 0.15,
    trustScore.score * 0.25,
    sensitivityScore.score * 0.1
  ]);

  const evaluation = {
    query,
    resultCount: results.length,
    overall: clamp(overall, 0, 1),
    dimensions: {
      relevance: relevanceScore,
      freshness: freshnessScore,
      diversity: diversityScore,
      trust: trustScore,
      sensitivity: sensitivityScore
    },
    warnings: collectWarnings(results, relevanceScore, trustScore, sensitivityScore),
    evaluatedAt: new Date().toISOString()
  };

  store.storeRetrievalEvaluation(evaluation.query, evaluation);
  return evaluation;
}

function evaluateRelevance(results, query) {
  const terms = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scores = results.map(r => {
    const content = (r.content || r.text || '').toLowerCase();
    let termHits = 0;
    for (const term of terms) {
      if (content.includes(term)) termHits++;
    }
    const termScore = terms.length > 0 ? termHits / terms.length : 0;
    const combined = (r.score || 0) * 0.6 + termScore * 0.4;
    return clamp(combined, 0, 1);
  });
  return {
    score: clamp(average(scores), 0, 1),
    details: scores,
    description: scores.length > 0 ? 'Term and vector relevance scoring' : 'No results to score'
  };
}

function evaluateFreshness(results) {
  const scores = results.map(r => {
    const scored = freshnessScorer.scoreSourceFreshness(r);
    return scored.score;
  });
  return {
    score: clamp(average(scores), 0, 1),
    details: scores,
    description: 'Freshness scoring across results'
  };
}

function evaluateDiversity(results) {
  const sources = new Set(results.map(r => r.source || r.sourceId || 'unknown'));
  const types = new Set(results.map(r => r.type || r.sourceType || 'text'));
  const sourceDiversity = results.length > 0 ? sources.size / results.length : 0;
  const typeDiversity = results.length > 0 ? types.size / results.length : 0;
  const score = clamp(average([sourceDiversity, typeDiversity]), 0, 1);
  return {
    score,
    uniqueSources: sources.size,
    uniqueTypes: types.size,
    description: 'Source and type diversity'
  };
}

function evaluateTrust(results) {
  const scores = results.map(r => {
    const scored = confidenceScorer.scoreSourceConfidence(r);
    return scored.score;
  });
  return {
    score: clamp(average(scores), 0, 1),
    details: scores,
    description: 'Confidence-based trust scoring'
  };
}

function evaluateSensitivity(results) {
  let hasSensitive = false;
  let hasBlocked = false;
  const labels = [];
  for (const r of results) {
    const sensitivity = r.sensitivity || r.metadata?.sensitivity || 'unknown';
    labels.push(sensitivity);
    if (sensitivity === 'secret_blocked') hasBlocked = true;
    if (['lifeos_private', 'security_sensitive', 'privacy_sensitive'].includes(sensitivity)) {
      hasSensitive = true;
    }
  }
  let score = 1.0;
  if (hasBlocked) score = 0;
  else if (hasSensitive) score = 0.5;
  return {
    score,
    labels,
    hasSensitive,
    hasBlocked,
    description: 'Sensitivity distribution scoring'
  };
}

function collectWarnings(results, relevance, trust, sensitivity) {
  const warnings = [];
  if (relevance.score < 0.3) warnings.push('low_relevance');
  if (trust.score < 0.4) warnings.push('low_trust_sources');
  if (sensitivity.hasBlocked) warnings.push('secret_blocked_detected');
  if (sensitivity.hasSensitive) warnings.push('sensitive_content_present');
  if (results.length < 2) warnings.push('insufficient_results');
  return warnings;
}

function createEmptyEvaluation(query) {
  return {
    query,
    resultCount: 0,
    overall: 0,
    dimensions: {
      relevance: { score: 0, description: 'No results' },
      freshness: { score: 0, description: 'No results' },
      diversity: { score: 0, description: 'No results' },
      trust: { score: 0, description: 'No results' },
      sensitivity: { score: 1, description: 'No results' }
    },
    warnings: ['no_results'],
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  evaluateRetrievalQuality,
  evaluateRelevance,
  evaluateFreshness,
  evaluateDiversity,
  evaluateTrust,
  evaluateSensitivity
};
