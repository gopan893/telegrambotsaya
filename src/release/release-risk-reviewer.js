'use strict';

const utils = require('./release-utils');

async function reviewReleaseRisks(releaseCandidateId, services = {}) {
  const risks = {
    boot: await detectReleaseSecurityRisk(services),
    dashboard: await detectReleasePrivacyRisk(services),
    telegram: await detectReleaseDeployRisk(services),
    storage: await detectReleaseCostRisk(services),
    executor: await detectReleaseOperationalRisk(services),
    integration: { risks: [], score: 100 }
  };

  const summary = buildReleaseRiskSummary(risks);
  return { releaseCandidateId, ...risks, summary };
}

async function detectReleaseSecurityRisk(services = {}) {
  const env = services.env || process.env || {};
  const risks = [];

  if (env.AUTO_APPROVE_ENABLED === 'true') {
    risks.push({ category: 'security', severity: 'critical', description: 'AUTO_APPROVE_ENABLED exposes production to unapproved actions' });
  }
  if (env.AUTO_RUN_ENABLED === 'true') {
    risks.push({ category: 'security', severity: 'critical', description: 'AUTO_RUN_ENABLED allows auto-execution of proposals' });
  }
  if (env.SHELL_EXECUTOR_ENABLED === 'true') {
    risks.push({ category: 'security', severity: 'critical', description: 'SHELL_EXECUTOR_ENABLED allows shell commands' });
  }
  if (!env.TELEGRAM_TOKEN) {
    risks.push({ category: 'security', severity: 'critical', description: 'TELEGRAM_TOKEN not set' });
  }

  return { risks, score: risks.filter(r => r.severity === 'critical').length === 0 ? 100 : 0 };
}

async function detectReleasePrivacyRisk(services = {}) {
  const risks = [];

  try {
    const privacy = require('../privacy/index.js');
  } catch (e) {
    risks.push({ category: 'privacy', severity: 'medium', description: 'Privacy module not loaded' });
  }

  return { risks, score: risks.length === 0 ? 100 : 75 };
}

async function detectReleaseDeployRisk(services = {}) {
  const env = services.env || process.env || {};
  const risks = [];

  if (!env.WEBHOOK_URL) {
    risks.push({ category: 'deploy', severity: 'high', description: 'WEBHOOK_URL not set, bot may not respond' });
  }
  if (!env.RENDER_DEPLOY_GATE && env.WEBHOOK_URL) {
    risks.push({ category: 'deploy', severity: 'low', description: 'RENDER_DEPLOY_GATE not checked' });
  }

  return { risks, score: risks.filter(r => r.severity === 'high' || r.severity === 'critical').length === 0 ? 100 : 50 };
}

async function detectReleaseCostRisk(services = {}) {
  const risks = [];

  try {
    const cost = require('../cost/index.js');
  } catch (e) {
    risks.push({ category: 'cost', severity: 'low', description: 'Cost governance not available' });
  }

  return { risks, score: risks.length === 0 ? 100 : 90 };
}

async function detectReleaseOperationalRisk(services = {}) {
  const env = services.env || process.env || {};
  const risks = [];

  if (!env.OWNER_CHAT_ID) {
    risks.push({ category: 'operational', severity: 'high', description: 'OWNER_CHAT_ID not configured' });
  }
  if (!env.DASHBOARD_ADMIN_TOKEN) {
    risks.push({ category: 'operational', severity: 'high', description: 'DASHBOARD_ADMIN_TOKEN not configured' });
  }

  return { risks, score: risks.filter(r => r.severity === 'high' || r.severity === 'critical').length === 0 ? 100 : 50 };
}

function buildReleaseRiskSummary(risks) {
  const allRisks = [];
  let totalScore = 0;
  let count = 0;

  for (const [, category] of Object.entries(risks)) {
    if (category && category.risks) {
      allRisks.push(...category.risks);
    }
    if (category && category.score !== undefined) {
      totalScore += category.score;
      count++;
    }
  }

  const avgScore = count > 0 ? Math.round(totalScore / count) : 100;
  const critical = allRisks.filter(r => r.severity === 'critical');
  const high = allRisks.filter(r => r.severity === 'high');
  const medium = allRisks.filter(r => r.severity === 'medium');
  const low = allRisks.filter(r => r.severity === 'low');

  return {
    totalRisks: allRisks.length,
    critical,
    high,
    medium,
    low,
    averageScore: avgScore,
    hasCriticalBlockers: critical.length > 0,
    safeToRelease: critical.length === 0 && avgScore >= 80,
    timestamp: utils.formatTimestamp()
  };
}

module.exports = {
  reviewReleaseRisks,
  detectReleaseSecurityRisk,
  detectReleasePrivacyRisk,
  detectReleaseDeployRisk,
  detectReleaseCostRisk,
  detectReleaseOperationalRisk,
  buildReleaseRiskSummary
};
