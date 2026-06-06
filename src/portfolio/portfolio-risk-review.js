'use strict';

const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

async function detectTooManyActiveProjects(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const count = snapshot.activeGoals.length;
  return {
    risk: count > 5 ? 'high' : (count > 3 ? 'medium' : 'low'),
    count,
    warning: count > 5 ? 'Too many active projects can fragment focus.' : ''
  };
}

async function detectApprovalBacklogRisk(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const highRisk = snapshot.pendingApprovals.filter(item => ['high', 'danger', 'critical'].includes(item.riskLevel));
  return {
    risk: highRisk.length ? 'high' : (snapshot.pendingApprovals.length >= 5 ? 'medium' : 'low'),
    pending: snapshot.pendingApprovals.length,
    highRisk: highRisk.length,
    warning: highRisk.length ? 'High-risk approval backlog needs human review.' : ''
  };
}

async function detectIncidentRisk(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const critical = snapshot.openIncidents.filter(item => ['critical', 'high'].includes(item.severity));
  return {
    risk: critical.length ? 'critical' : (snapshot.openIncidents.length ? 'medium' : 'low'),
    open: snapshot.openIncidents.length,
    critical: critical.length,
    warning: critical.length ? 'Critical/high incident open; stabilize first.' : ''
  };
}

async function detectCrossProjectRisk(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const warnings = [];
  if (snapshot.githubOpsStatus?.dirty) warnings.push('Uncommitted repo changes may affect release readiness.');
  if (snapshot.latestDeployStatus?.gateOk === false) warnings.push('Deploy gate is not passing.');
  if (snapshot.costStatus?.status === 'warning') warnings.push('Cost/token usage has warning signals.');
  if (snapshot.blockedTasks.length) warnings.push(`${snapshot.blockedTasks.length} blocked task(s) across projects.`);
  return { risk: warnings.length >= 3 ? 'high' : (warnings.length ? 'medium' : 'low'), warnings };
}

async function reviewPortfolioRisk(workspaceId, services = {}) {
  const [tooMany, approvalBacklog, incident, cross] = await Promise.all([
    detectTooManyActiveProjects(workspaceId, services),
    detectApprovalBacklogRisk(workspaceId, services),
    detectIncidentRisk(workspaceId, services),
    detectCrossProjectRisk(workspaceId, services)
  ]);
  const riskLevel = utils.maxRisk([tooMany.risk, approvalBacklog.risk, incident.risk, cross.risk]);
  const summary = utils.sanitize({
    ok: true,
    workspaceId,
    riskLevel,
    tooManyActiveProjects: tooMany,
    approvalBacklog,
    incidentRisk: incident,
    crossProjectRisk: cross,
    warnings: [tooMany.warning, approvalBacklog.warning, incident.warning, ...(cross.warnings || [])].filter(Boolean),
    recommendations: buildPortfolioRiskRecommendations(riskLevel, { tooMany, approvalBacklog, incident, cross })
  });
  await utils.auditPortfolio('portfolio/risk_review_run', { workspaceId, userId: services.userId, summary }, services);
  return summary;
}

function buildPortfolioRiskRecommendations(riskLevel, parts = {}) {
  if (riskLevel === 'critical') return ['Stop feature work and handle incident/safety blocker first.'];
  if (riskLevel === 'high') return ['Reduce active work-in-progress, review approvals, and stabilize blocked systems.'];
  if (riskLevel === 'medium') return ['Pick one top project and clear stale/blocked tasks before starting new work.'];
  return ['Portfolio risk looks manageable; keep approval and evaluation gates active.'];
}

async function buildPortfolioRiskSummary(workspaceId, services = {}) {
  const review = await reviewPortfolioRisk(workspaceId, services);
  return [
    `Risk: ${review.riskLevel}`,
    `Warnings: ${review.warnings.length ? review.warnings.join('; ') : '-'}`,
    `Recommendations: ${review.recommendations.join(' ')}`
  ].join('\n');
}

module.exports = {
  buildPortfolioRiskSummary,
  detectApprovalBacklogRisk,
  detectCrossProjectRisk,
  detectIncidentRisk,
  detectTooManyActiveProjects,
  reviewPortfolioRisk
};
