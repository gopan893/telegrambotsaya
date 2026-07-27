'use strict';

const { calculateAgeDays, freshnessLabel, average, clamp } = require('./memory-intelligence-utils');
const sensitivityClassifier = require('./memory-sensitivity-classifier');
const freshnessReviewer = require('./memory-freshness-reviewer');

function calculateQualityScorecard(memories, options = {}) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return createEmptyScorecard();
  }

  const freshnessScores = freshnessReviewer.reviewBatch(memories);
  const sensitivityDist = sensitivityClassifier.getSensitivityDistribution(memories);

  const dimensions = {
    freshness: calculateFreshnessDimension(freshnessScores),
    completeness: calculateCompletenessDimension(memories),
    sensitivity: calculateSensitivityDimension(sensitivityDist),
    uniqueness: calculateUniquenessDimension(memories),
    recency: calculateRecencyDimension(memories),
    coverage: calculateCoverageDimension(memories)
  };

  const overall = average(Object.values(dimensions).map(d => d.score));
  const grade = scoreToGrade(overall);

  return {
    overallScore: clamp(overall, 0, 1),
    grade,
    dimensions,
    totalMemories: memories.length,
    sensitivityDistribution: sensitivityDist,
    recommendations: generateScorecardRecommendations(dimensions, sensitivityDist),
    calculatedAt: new Date().toISOString()
  };
}

function calculateFreshnessDimension(freshnessScores) {
  if (freshnessScores.length === 0) return { score: 0, detail: 'No memories reviewed' };
  const avg = average(freshnessScores.map(f => f.score));
  const staleCount = freshnessScores.filter(f => f.freshness === 'stale' || f.freshness === 'ancient').length;
  return {
    score: clamp(avg, 0, 1),
    averageFreshness: avg,
    staleCount,
    detail: `${staleCount} stale out of ${freshnessScores.length}`
  };
}

function calculateCompletenessDimension(memories) {
  let completeCount = 0;
  for (const m of memories) {
    let completeness = 0;
    if (m.content && m.content.length > 10) completeness += 0.3;
    if (m.tags && m.tags.length > 0) completeness += 0.2;
    if (m.createdAt) completeness += 0.2;
    if (m.source && m.source !== 'unknown') completeness += 0.15;
    if (m.metadata && Object.keys(m.metadata).length > 0) completeness += 0.15;
    if (completeness >= 0.6) completeCount++;
  }
  return {
    score: memories.length > 0 ? completeCount / memories.length : 0,
    completeCount,
    detail: `${completeCount}/${memories.length} memories are complete`
  };
}

function calculateSensitivityDimension(sensitivityDist) {
  const blocked = sensitivityDist.blockedCount || 0;
  const ownerOnly = sensitivityDist.ownerOnlyCount || 0;
  const total = sensitivityDist.total || 1;
  const safeRatio = (sensitivityDist.ragSafeCount || 0) / total;
  const blockedPenalty = blocked / total;
  return {
    score: clamp(safeRatio - blockedPenalty * 0.5, 0, 1),
    ragSafeCount: sensitivityDist.ragSafeCount || 0,
    blockedCount: blocked,
    ownerOnlyCount: ownerOnly,
    detail: `${blocked} blocked, ${ownerOnly} owner-only, ${sensitivityDist.ragSafeCount || 0} RAG-safe`
  };
}

function calculateUniquenessDimension(memories) {
  const contentSet = new Set();
  for (const m of memories) {
    const normalized = (m.content || '').toLowerCase().trim().slice(0, 100);
    contentSet.add(normalized);
  }
  const uniqueRatio = memories.length > 0 ? contentSet.size / memories.length : 0;
  return {
    score: clamp(uniqueRatio, 0, 1),
    uniqueContentCount: contentSet.size,
    detail: `${contentSet.size} unique content items out of ${memories.length}`
  };
}

function calculateRecencyDimension(memories) {
  let recentCount = 0;
  for (const m of memories) {
    const ageDays = calculateAgeDays(m.updatedAt || m.createdAt);
    if (ageDays <= 30) recentCount++;
  }
  return {
    score: memories.length > 0 ? recentCount / memories.length : 0,
    recentCount,
    detail: `${recentCount}/${memories.length} memories updated within 30 days`
  };
}

function calculateCoverageDimension(memories) {
  const tagCounts = {};
  for (const m of memories) {
    for (const tag of (m.tags || [])) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const uniqueTags = Object.keys(tagCounts).length;
  const coverageScore = uniqueTags > 0 ? Math.min(uniqueTags / 10, 1) : 0;
  return {
    score: coverageScore,
    uniqueTagCount: uniqueTags,
    topTags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
    detail: `${uniqueTags} unique tags across memories`
  };
}

function generateScorecardRecommendations(dimensions, sensitivityDist) {
  const recs = [];
  if (dimensions.freshness.score < 0.5) {
    recs.push({ priority: 'medium', action: 'Review and update stale memories', category: 'freshness' });
  }
  if (dimensions.completeness.score < 0.5) {
    recs.push({ priority: 'low', action: 'Add missing metadata to incomplete memories', category: 'completeness' });
  }
  if (sensitivityDist.blockedCount > 0) {
    recs.push({ priority: 'high', action: `${sensitivityDist.blockedCount} memories contain secrets — review immediately`, category: 'security' });
  }
  if (dimensions.uniqueness.score < 0.7) {
    recs.push({ priority: 'medium', action: 'Many duplicate content items detected — consider merging', category: 'uniqueness' });
  }
  if (dimensions.recency.score < 0.3) {
    recs.push({ priority: 'low', action: 'Most memories are old — consider refreshing', category: 'recency' });
  }
  return recs;
}

function scoreToGrade(score) {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B+';
  if (score >= 0.7) return 'B';
  if (score >= 0.6) return 'C+';
  if (score >= 0.5) return 'C';
  if (score >= 0.4) return 'D';
  return 'F';
}

function createEmptyScorecard() {
  return {
    overallScore: 0,
    grade: 'F',
    dimensions: {},
    totalMemories: 0,
    sensitivityDistribution: { total: 0, counts: {}, blockedCount: 0, ownerOnlyCount: 0, ragSafeCount: 0 },
    recommendations: [{ priority: 'high', action: 'No memories to evaluate', category: 'input' }],
    calculatedAt: new Date().toISOString()
  };
}

module.exports = { calculateQualityScorecard, scoreToGrade };
