'use strict';

const store = require('./memory-intelligence-store');
const { average, clamp } = require('./memory-intelligence-utils');

function generateIntelligenceReport(data, options = {}) {
  if (!data || typeof data !== 'object') {
    return createEmptyReport('invalid_input');
  }

  const report = {
    id: `mir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    summary: generateSummary(data),
    duplicates: data.duplicates || { pairCount: 0, duplicates: [] },
    conflicts: data.conflicts || { conflictCount: 0, conflicts: [] },
    freshness: data.freshness || { staleCount: 0 },
    sensitivity: data.sensitivity || { blockedCount: 0 },
    qualityScorecard: data.qualityScorecard || null,
    mergeProposals: data.mergeProposals || [],
    recommendations: generateRecommendations(data),
    metadata: options.metadata || {}
  };

  return report;
}

function generateSummary(data) {
  const totalIssues = (data.duplicates?.pairCount || 0) +
    (data.conflicts?.conflictCount || 0) +
    (data.freshness?.staleCount || 0) +
    (data.sensitivity?.blockedCount || 0);

  const qualityScore = data.qualityScorecard?.overallScore || 0;
  const blockedCount = data.sensitivity?.blockedCount || 0;

  return {
    totalMemories: data.totalMemories || 0,
    qualityScore: clamp(qualityScore, 0, 1),
    grade: data.qualityScorecard?.grade || 'N/A',
    totalIssues,
    duplicatePairs: data.duplicates?.pairCount || 0,
    conflictCount: data.conflicts?.conflictCount || 0,
    staleCount: data.freshness?.staleCount || 0,
    secretBlockedCount: blockedCount,
    pendingMergeProposals: (data.mergeProposals || []).length,
    hasCriticalIssues: blockedCount > 0
  };
}

function generateRecommendations(data) {
  const recommendations = [];

  if ((data.sensitivity?.blockedCount || 0) > 0) {
    recommendations.push({
      priority: 'critical',
      action: 'Remove or redact secret-containing memories immediately',
      category: 'security',
      count: data.sensitivity.blockedCount
    });
  }

  if ((data.duplicates?.pairCount || 0) > 0) {
    recommendations.push({
      priority: 'high',
      action: `Review ${data.duplicates.pairCount} duplicate pair(s) for potential merge`,
      category: 'duplicates',
      count: data.duplicates.pairCount,
      proposalOnly: true
    });
  }

  if ((data.conflicts?.conflictCount || 0) > 0) {
    recommendations.push({
      priority: 'high',
      action: `Resolve ${data.conflicts.conflictCount} conflicting memory pair(s)`,
      category: 'conflicts',
      count: data.conflicts.conflictCount
    });
  }

  if ((data.freshness?.staleCount || 0) > 0) {
    recommendations.push({
      priority: 'medium',
      action: `Review ${data.freshness.staleCount} stale memory item(s)`,
      category: 'freshness',
      count: data.freshness.staleCount
    });
  }

  const qualityScore = data.qualityScorecard?.overallScore || 0;
  if (qualityScore < 0.5) {
    recommendations.push({
      priority: 'high',
      action: 'Overall memory quality is below threshold — comprehensive review recommended',
      category: 'quality'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'none',
      action: 'Memory intelligence is healthy — no actions needed',
      category: 'status'
    });
  }

  return recommendations;
}

function createEmptyReport(reason) {
  return {
    id: `mir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    summary: { totalMemories: 0, qualityScore: 0, grade: 'F', totalIssues: 0 },
    duplicates: { pairCount: 0, duplicates: [] },
    conflicts: { conflictCount: 0, conflicts: [] },
    freshness: { staleCount: 0 },
    sensitivity: { blockedCount: 0 },
    qualityScorecard: null,
    mergeProposals: [],
    recommendations: [{ priority: 'high', action: `Cannot generate report: ${reason}`, category: 'error' }],
    metadata: {}
  };
}

module.exports = { generateIntelligenceReport };
