'use strict';

const store = require('./rag-quality-store');
const { average, clamp } = require('./rag-quality-utils');

function generateQualityReport(evalResults, options = {}) {
  if (!evalResults || typeof evalResults !== 'object') {
    return createEmptyReport('invalid_input');
  }

  const report = {
    id: `rqr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    summary: generateSummary(evalResults),
    dimensions: extractDimensions(evalResults),
    issues: extractIssues(evalResults),
    recommendations: generateRecommendations(evalResults),
    scorecard: generateScorecard(evalResults),
    metadata: options.metadata || {}
  };

  return report;
}

function generateSummary(evalResults) {
  const scores = [];
  if (evalResults.overall !== undefined) scores.push(evalResults.overall);
  if (evalResults.dimensions) {
    for (const dim of Object.values(evalResults.dimensions)) {
      if (dim && typeof dim.score === 'number') scores.push(dim.score);
    }
  }

  const avgScore = scores.length > 0 ? average(scores) : 0;
  const issues = evalResults.warnings || [];

  return {
    overallScore: clamp(avgScore, 0, 1),
    grade: scoreToGrade(avgScore),
    issueCount: issues.length,
    hasSecrets: issues.includes('secrets_detected') || issues.includes('secret_blocked_detected'),
    hasLowRelevance: issues.includes('low_relevance'),
    hasLowTrust: issues.includes('low_trust_sources'),
    resultCount: evalResults.resultCount || 0,
    queryCount: evalResults.query ? 1 : 0
  };
}

function extractDimensions(evalResults) {
  const dimensions = {};
  if (evalResults.dimensions) {
    for (const [key, dim] of Object.entries(evalResults.dimensions)) {
      dimensions[key] = {
        score: dim.score || 0,
        description: dim.description || '',
        grade: scoreToGrade(dim.score || 0)
      };
    }
  }
  return dimensions;
}

function extractIssues(evalResults) {
  const issues = [];
  const warnings = evalResults.warnings || [];
  for (const warning of warnings) {
    issues.push({
      type: warning,
      severity: classifyIssueSeverity(warning),
      description: describeIssue(warning)
    });
  }
  return issues;
}

function generateRecommendations(evalResults) {
  const recommendations = [];
  const warnings = evalResults.warnings || [];

  if (warnings.includes('low_relevance')) {
    recommendations.push({
      priority: 'high',
      action: 'Improve query specificity or expand source coverage',
      category: 'relevance'
    });
  }
  if (warnings.includes('low_trust_sources')) {
    recommendations.push({
      priority: 'high',
      action: 'Add verified/official sources to knowledge base',
      category: 'trust'
    });
  }
  if (warnings.includes('secrets_detected') || warnings.includes('secret_blocked_detected')) {
    recommendations.push({
      priority: 'critical',
      action: 'Remove or redact secret-containing sources immediately',
      category: 'security'
    });
  }
  if (warnings.includes('stale_detected')) {
    recommendations.push({
      priority: 'medium',
      action: 'Update stale sources with fresh data',
      category: 'freshness'
    });
  }
  if (warnings.includes('insufficient_results')) {
    recommendations.push({
      priority: 'medium',
      action: 'Increase knowledge base coverage for this query domain',
      category: 'coverage'
    });
  }
  if (warnings.includes('no_results')) {
    recommendations.push({
      priority: 'high',
      action: 'Add relevant documents to knowledge base',
      category: 'coverage'
    });
  }
  if (evalResults.resultCount === 0) {
    recommendations.push({
      priority: 'critical',
      action: 'Knowledge base has no results for this query',
      category: 'coverage'
    });
  }

  return recommendations;
}

function generateScorecard(evalResults) {
  const dimensions = evalResults.dimensions || {};
  const scores = {};
  for (const [key, dim] of Object.entries(dimensions)) {
    scores[key] = {
      score: dim.score || 0,
      weight: getDimensionWeight(key),
      weightedScore: (dim.score || 0) * getDimensionWeight(key)
    };
  }
  const totalWeight = Object.values(scores).reduce((sum, s) => sum + s.weight, 0);
  const weightedTotal = Object.values(scores).reduce((sum, s) => sum + s.weightedScore, 0);
  return {
    dimensions: scores,
    totalWeightedScore: totalWeighted,
    maxPossibleScore: totalWeight,
    normalizedScore: totalWeight > 0 ? clamp(weightedTotal / totalWeight, 0, 1) : 0
  };
}

function getDimensionWeight(key) {
  const weights = { relevance: 0.35, trust: 0.25, freshness: 0.15, diversity: 0.15, sensitivity: 0.1 };
  return weights[key] || 0.1;
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

function classifyIssueSeverity(warning) {
  const critical = ['secrets_detected', 'secret_blocked_detected'];
  const high = ['low_relevance', 'low_trust_sources', 'no_results'];
  const medium = ['stale_detected', 'insufficient_results', 'sensitive_content_present'];
  if (critical.includes(warning)) return 'critical';
  if (high.includes(warning)) return 'high';
  if (medium.includes(warning)) return 'medium';
  return 'low';
}

function describeIssue(warning) {
  const descriptions = {
    low_relevance: 'Retrieved results have low relevance to the query',
    low_trust_sources: 'Sources have low trust/confidence scores',
    secrets_detected: 'Secret or API key patterns found in content',
    secret_blocked_detected: 'Blocked secret content detected in results',
    stale_detected: 'Sources are outdated and may contain stale information',
    insufficient_results: 'Too few results retrieved for reliable answering',
    no_results: 'No results found for the query',
    sensitive_content_present: 'Sensitive content detected in results'
  };
  return descriptions[warning] || 'Unknown issue';
}

function createEmptyReport(reason) {
  return {
    id: `rqr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    summary: { overallScore: 0, grade: 'F', issueCount: 1, resultCount: 0 },
    dimensions: {},
    issues: [{ type: reason, severity: 'high', description: 'No valid evaluation data' }],
    recommendations: [{ priority: 'high', action: 'Provide valid evaluation data', category: 'input' }],
    scorecard: { dimensions: {}, totalWeightedScore: 0, normalizedScore: 0 },
    metadata: {}
  };
}

module.exports = { generateQualityReport, scoreToGrade };
