'use strict';

const { calculateAgeDays, freshnessLabel, clamp } = require('./rag-quality-utils');
const store = require('./rag-quality-store');

const FRESHNESS_THRESHOLDS = {
  fresh: 7,
  recent: 30,
  aging: 90,
  stale: Infinity
};

function scoreSourceFreshness(source) {
  if (!source || typeof source !== 'object') {
    return { freshness: 'unknown', ageDays: Infinity, score: 0, reasons: ['invalid_source'] };
  }

  const reasons = [];
  const dateStr = source.updatedAt || source.publishedAt || source.date || source.createdAt;
  const ageDays = calculateAgeDays(dateStr);

  if (!dateStr) {
    reasons.push('no_date_found');
  } else {
    reasons.push(`date:${dateStr}`);
  }

  const freshness = freshnessLabel(ageDays);
  reasons.push(`freshness:${freshness}`);

  let score;
  if (ageDays === Infinity) {
    score = 0.1;
  } else if (ageDays <= FRESHNESS_THRESHOLDS.fresh) {
    score = 1.0;
  } else if (ageDays <= FRESHNESS_THRESHOLDS.recent) {
    score = 0.7;
  } else if (ageDays <= FRESHNESS_THRESHOLDS.aging) {
    score = 0.4;
  } else {
    score = 0.1;
    reasons.push('stale_detected');
  }

  if (source.explicitlyDated === false) {
    score = clamp(score - 0.1, 0, 1);
    reasons.push('implicit_date');
  }

  const result = {
    sourceId: source.id || source.sourceId,
    freshness,
    ageDays: Math.round(ageDays * 10) / 10,
    score,
    reasons
  };

  store.storeFreshnessScore(source.id || source.sourceId, result);
  return result;
}

function detectStaleSources(sources, staleThresholdDays) {
  const threshold = staleThresholdDays || 90;
  if (!Array.isArray(sources)) return [];
  return sources
    .map(s => scoreSourceFreshness(s))
    .filter(r => r.ageDays > threshold || r.freshness === 'stale');
}

function scoreBatch(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map(s => scoreSourceFreshness(s));
}

function getFreshnessSummary(sources) {
  const scored = scoreBatch(sources);
  const counts = { fresh: 0, recent: 0, aging: 0, stale: 0, unknown: 0 };
  for (const s of scored) {
    counts[s.freshness] = (counts[s.freshness] || 0) + 1;
  }
  return {
    total: scored.length,
    counts,
    staleCount: counts.stale,
    oldestAgeDays: Math.max(...scored.map(s => s.ageDays === Infinity ? 0 : s.ageDays), 0)
  };
}

module.exports = { scoreSourceFreshness, detectStaleSources, scoreBatch, getFreshnessSummary };
