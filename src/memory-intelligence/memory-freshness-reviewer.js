'use strict';

const { calculateAgeDays, freshnessLabel } = require('./memory-intelligence-utils');
const store = require('./memory-intelligence-store');

const FRESHNESS_THRESHOLDS = {
  fresh: 7,
  recent: 30,
  aging: 90,
  stale: 180,
  ancient: 365
};

function reviewMemoryFreshness(memory) {
  if (!memory || typeof memory !== 'object') {
    return { freshness: 'unknown', ageDays: Infinity, score: 0, warnings: ['invalid_memory'] };
  }

  const warnings = [];
  const updatedAt = memory.updatedAt || memory.createdAt;
  const lastAccessed = memory.lastAccessedAt;
  const ageDays = calculateAgeDays(updatedAt);
  const accessAgeDays = lastAccessed ? calculateAgeDays(lastAccessed) : Infinity;

  const freshness = freshnessLabel(ageDays);
  let score = freshnessToScore(freshness);

  if (accessAgeDays < ageDays && accessAgeDays !== Infinity) {
    score = Math.min(score + 0.1, 1.0);
    warnings.push('recently_accessed');
  }

  if (memory.accessCount && memory.accessCount > 5) {
    score = Math.min(score + 0.05, 1.0);
  }

  if (ageDays > FRESHNESS_THRESHOLDS.stale) {
    warnings.push('stale_memory');
  }
  if (ageDays > FRESHNESS_THRESHOLDS.ancient) {
    warnings.push('ancient_memory');
  }
  if (!memory.updatedAt && !memory.createdAt) {
    warnings.push('no_date_info');
  }

  return {
    memoryId: memory.id,
    freshness,
    ageDays: Math.round(ageDays * 10) / 10,
    accessAgeDays: Math.round(accessAgeDays * 10) / 10,
    accessCount: memory.accessCount || 0,
    score,
    warnings,
    recommendation: generateFreshnessRecommendation(freshness, warnings, memory)
  };
}

function freshnessToScore(freshness) {
  const scores = {
    fresh: 1.0,
    recent: 0.8,
    aging: 0.5,
    stale: 0.2,
    ancient: 0.1,
    unknown: 0.3
  };
  return scores[freshness] || 0.3;
}

function generateFreshnessRecommendation(freshness, warnings, memory) {
  if (freshness === 'stale' || freshness === 'ancient') {
    return {
      action: 'review',
      message: 'Memory is stale. Consider reviewing if still relevant.',
      priority: 'medium',
      proposalOnly: true
    };
  }
  if (warnings.includes('no_date_info')) {
    return {
      action: 'annotate',
      message: 'Memory has no date. Consider adding timestamps.',
      priority: 'low',
      proposalOnly: true
    };
  }
  return {
    action: 'keep',
    message: 'Memory freshness is acceptable.',
    priority: 'none',
    proposalOnly: true
  };
}

function reviewBatch(memories) {
  if (!Array.isArray(memories)) return [];
  return memories.map(m => reviewMemoryFreshness(m));
}

function getFreshnessSummary(memories) {
  const reviewed = reviewBatch(memories);
  const counts = { fresh: 0, recent: 0, aging: 0, stale: 0, ancient: 0, unknown: 0 };
  for (const r of reviewed) {
    counts[r.freshness] = (counts[r.freshness] || 0) + 1;
  }
  return {
    total: reviewed.length,
    counts,
    staleCount: (counts.stale || 0) + (counts.ancient || 0),
    averageScore: reviewed.length > 0
      ? reviewed.reduce((sum, r) => sum + r.score, 0) / reviewed.length
      : 0
  };
}

module.exports = { reviewMemoryFreshness, reviewBatch, getFreshnessSummary, FRESHNESS_THRESHOLDS };
