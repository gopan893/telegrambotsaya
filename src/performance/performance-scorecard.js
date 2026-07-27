'use strict';

const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());

function calculateDashboardPerformanceScore(services = {}) {
  const auditor = require('./dashboard-bundle-auditor');
  const sizes = auditor.auditDashboardAssetSizes(services);
  const largeFiles = auditor.detectLargeDashboardFiles(services);
  const duplicates = auditor.detectDuplicateDashboardScripts(services);
  const unused = auditor.detectUnusedDashboardScriptReferences(services);

  const largeFilePenalty = largeFiles.length * 5;
  const duplicatePenalty = duplicates.length * 10;
  const unusedPenalty = unused.length * 5;
  const sizePenalty = sizes.totalSize > 1048576 ? 10 : sizes.totalSize > 524288 ? 5 : 0;

  const deductions = largeFilePenalty + duplicatePenalty + unusedPenalty + sizePenalty;
  const score = Math.max(0, Math.min(100, 100 - deductions));

  return {
    score,
    deductions: {
      largeFiles: largeFilePenalty,
      duplicates: duplicatePenalty,
      unused: unusedPenalty,
      bundleSize: sizePenalty
    },
    details: {
      totalFiles: sizes.fileCount,
      totalSize: sizes.totalSizeFormatted,
      largeFileCount: largeFiles.length,
      duplicateCount: duplicates.length,
      unusedCount: unused.length
    }
  };
}

function calculateStartupPerformanceScore(services = {}) {
  const profiler = require('./startup-profiler');
  const cost = profiler.profileStartupStaticCost(services);
  const risk = profiler.detectSlowStartupRisk(services);

  const requirePenalty = cost.totalRequires > 100 ? 20 : cost.totalRequires > 50 ? 10 : cost.totalRequires > 30 ? 5 : 0;
  const riskPenalty = risk.risks.length * 5;

  const deductions = requirePenalty + riskPenalty;
  const score = Math.max(0, Math.min(100, 100 - deductions));

  return {
    score,
    deductions: {
      requireCount: requirePenalty,
      risks: riskPenalty
    },
    details: {
      totalRequires: cost.totalRequires,
      riskCount: risk.risks.length
    }
  };
}

function calculateApiPerformanceScore(services = {}) {
  const profiler = require('./api-response-profiler');
  const slowRisks = profiler.detectSlowDashboardApiRisk(services);
  const payloads = profiler.detectLargeDashboardApiPayloads(services);

  const riskPenalty = slowRisks.risks.length * 5;
  const payloadPenalty = payloads.largePayloads.length * 3;

  const deductions = riskPenalty + payloadPenalty;
  const score = Math.max(0, Math.min(100, 100 - deductions));

  return {
    score,
    deductions: {
      slowEndpoints: riskPenalty,
      largePayloads: payloadPenalty
    },
    details: {
      slowEndpointCount: slowRisks.risks.length,
      largePayloadCount: payloads.largePayloads.length
    }
  };
}

function calculatePwaPerformanceScore(services = {}) {
  const auditor = require('./cache-efficiency-auditor');
  const apiCache = auditor.auditApiNoCachePolicy(services);

  const penalty = apiCache.apiCachingWarning ? 30 : 0;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    deductions: {
      apiCaching: penalty
    },
    details: {
      apiCachingWarning: apiCache.apiCachingWarning
    }
  };
}

function calculatePerformanceScorecard(services = {}) {
  const dashboard = calculateDashboardPerformanceScore(services);
  const startup = calculateStartupPerformanceScore(services);
  const api = calculateApiPerformanceScore(services);
  const pwa = calculatePwaPerformanceScore(services);

  const scores = [dashboard.score, startup.score, api.score, pwa.score];
  const overall = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  return {
    timestamp: new Date().toISOString(),
    overall,
    dashboard: dashboard.score,
    startup: startup.score,
    api: api.score,
    pwa: pwa.score,
    details: { dashboard, startup, api, pwa },
    rating: overall >= 95 ? 'excellent' : overall >= 85 ? 'good' : overall >= 70 ? 'needs_attention' : 'blocker'
  };
}

function buildPerformanceScoreExplanation(scorecard, services = {}) {
  if (!scorecard) scorecard = calculatePerformanceScorecard(services);

  const explanations = [];

  if (scorecard.dashboard.score >= 95) {
    explanations.push('Dashboard bundle is well-optimized');
  } else if (scorecard.dashboard.score >= 85) {
    explanations.push('Dashboard bundle is acceptable but could be smaller');
  } else {
    explanations.push('Dashboard bundle needs optimization - too many large files or duplicates');
  }

  if (scorecard.startup.score >= 95) {
    explanations.push('Startup time is excellent with minimal requires');
  } else if (scorecard.startup.score >= 85) {
    explanations.push('Startup requires are moderate');
  } else {
    explanations.push('Startup has too many requires or large files');
  }

  if (scorecard.api.score >= 95) {
    explanations.push('API endpoints are well-structured');
  } else if (scorecard.api.score >= 85) {
    explanations.push('API endpoints could be optimized');
  } else {
    explanations.push('API endpoints have performance risks');
  }

  if (scorecard.pwa.score >= 95) {
    explanations.push('PWA caching policy is correct');
  } else {
    explanations.push('PWA caching policy has issues - API routes should not be cached');
  }

  return {
    timestamp: new Date().toISOString(),
    overall: scorecard.overall,
    rating: scorecard.rating,
    explanations,
    summary: `Overall performance score: ${scorecard.overall}/100 (${scorecard.rating})`
  };
}

module.exports = {
  calculatePerformanceScorecard,
  calculateDashboardPerformanceScore,
  calculateStartupPerformanceScore,
  calculateApiPerformanceScore,
  calculatePwaPerformanceScore,
  buildPerformanceScoreExplanation
};
