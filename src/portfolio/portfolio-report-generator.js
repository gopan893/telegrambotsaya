'use strict';

const scanner = require('./portfolio-scanner');
const priority = require('./project-priority-engine');
const riskReview = require('./portfolio-risk-review');
const costReview = require('./portfolio-cost-review');
const nextAction = require('./portfolio-next-action-engine');
const dependency = require('./project-dependency-detector');
const utils = require('./portfolio-utils');

async function buildBaseReport(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const ranked = await priority.rankProjects(snapshot.workspaceId, services);
  const risk = await riskReview.reviewPortfolioRisk(snapshot.workspaceId, services);
  const cost = await costReview.buildPortfolioCostSummary(snapshot.workspaceId, services);
  const next = await nextAction.recommendPortfolioNextAction(snapshot.workspaceId, services);
  const graph = await dependency.buildDependencyGraph(snapshot.workspaceId, services);
  return { snapshot, ranked, risk, cost, next, graph };
}

function toTextReport(title, data = {}) {
  const top = data.ranked?.[0];
  return [
    title,
    '',
    `Workspace: ${data.snapshot?.workspaceId || '-'}`,
    `Active projects: ${data.snapshot?.totals?.activeGoals || 0}`,
    `Open tasks: ${data.snapshot?.totals?.activeTasks || 0}`,
    `Blocked tasks: ${data.snapshot?.totals?.blockedTasks || 0}`,
    `Pending approvals: ${data.snapshot?.totals?.pendingApprovals || 0}`,
    `Open incidents: ${data.snapshot?.totals?.openIncidents || 0}`,
    '',
    `Top priority: ${top?.goal?.title || '-'}`,
    `Priority reason: ${top?.explanation || '-'}`,
    `Next action: ${data.next?.summary || '-'}`,
    '',
    `Risk: ${data.risk?.riskLevel || '-'}`,
    `Cost: ${data.cost?.status || '-'} | avg tokens ${data.cost?.averageTokens || 0}`,
    `Dependencies: ${(data.graph?.edges || []).length}`
  ].join('\n');
}

async function generatePortfolioDailyReport(workspaceId, services = {}) {
  const data = await buildBaseReport(workspaceId, services);
  return utils.sanitize({ ok: true, type: 'daily', ...data, text: toTextReport('Daily Portfolio Report', data), generatedAt: utils.nowIso() });
}

async function generatePortfolioWeeklyReport(workspaceId, services = {}) {
  const data = await buildBaseReport(workspaceId, services);
  return utils.sanitize({ ok: true, type: 'weekly', ...data, text: toTextReport('Weekly Portfolio Report', data), generatedAt: utils.nowIso() });
}

async function generatePortfolioMonthlyReport(workspaceId, services = {}) {
  const data = await buildBaseReport(workspaceId, services);
  return utils.sanitize({ ok: true, type: 'monthly', ...data, text: toTextReport('Monthly Portfolio Report', data), generatedAt: utils.nowIso() });
}

async function generatePortfolioExecutiveSummary(workspaceId, services = {}) {
  const data = await buildBaseReport(workspaceId, services);
  return utils.sanitize({
    ok: true,
    type: 'executive',
    summary: {
      topProject: data.ranked?.[0]?.goal || null,
      nextAction: data.next?.summary || '',
      riskLevel: data.risk?.riskLevel || 'low',
      costStatus: data.cost?.status || 'unknown',
      activeProjects: data.snapshot?.totals?.activeGoals || 0
    },
    text: toTextReport('Portfolio Executive Summary', data),
    generatedAt: utils.nowIso()
  });
}

async function generateProjectComparisonReport(workspaceId, services = {}) {
  const ranked = await priority.rankProjects(workspaceId, services);
  return utils.sanitize({
    ok: true,
    workspaceId,
    items: ranked.map((item, index) => ({
      rank: index + 1,
      goalId: item.goalId,
      title: item.goal?.title || item.goalId,
      priorityScore: item.priorityScore,
      healthScore: item.health?.score,
      status: item.health?.status,
      recommendation: item.recommendation
    })),
    generatedAt: utils.nowIso()
  });
}

module.exports = {
  generatePortfolioDailyReport,
  generatePortfolioExecutiveSummary,
  generatePortfolioMonthlyReport,
  generatePortfolioWeeklyReport,
  generateProjectComparisonReport
};
