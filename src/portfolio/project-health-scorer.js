'use strict';

const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

async function getSnapshotForGoal(goalId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const goal = (snapshot.activeGoals || []).find(item => String(item.id) === String(goalId)) || utils.summarizeGoal({ id: goalId, title: goalId, workspaceId });
  const tasks = (snapshot.openTasks || []).filter(task => !task.linkedGoalId || String(task.linkedGoalId) === String(goalId));
  return { snapshot, goal, tasks };
}

function statusFromScore(score, blockers = [], critical = false) {
  if (critical || score <= 25) return 'critical';
  if (blockers.length || score <= 50) return 'blocked';
  if (score <= 74) return 'warning';
  return 'healthy';
}

async function scoreProgressHealth(goalId, services = {}) {
  const { goal, tasks } = await getSnapshotForGoal(goalId, services);
  const done = tasks.filter(task => task.status === 'done').length;
  const open = tasks.filter(task => ['todo', 'doing', 'blocked'].includes(task.status)).length;
  const explicit = Number(goal.progress || 0);
  const inferred = tasks.length ? Math.round((done / tasks.length) * 100) : explicit;
  const progress = Math.max(explicit, inferred);
  const score = tasks.length ? utils.clampScore(progress || (open ? 35 : 70)) : utils.clampScore(progress || 55);
  return { score, progress, reasons: [`Progress ${progress || 0}%`, `${open} open tasks`], blockers: [] };
}

async function scoreRiskHealth(goalId, services = {}) {
  const { snapshot, tasks } = await getSnapshotForGoal(goalId, services);
  const blockers = [];
  const criticalIncident = (snapshot.openIncidents || []).find(item => ['critical', 'high'].includes(item.severity));
  if (criticalIncident) blockers.push(`Open ${criticalIncident.severity} incident: ${criticalIncident.title}`);
  const blockedTasks = tasks.filter(task => task.status === 'blocked');
  if (blockedTasks.length) blockers.push(`${blockedTasks.length} blocked task(s)`);
  const pendingDanger = (snapshot.pendingApprovals || []).filter(item => ['high', 'danger', 'critical'].includes(item.riskLevel));
  if (pendingDanger.length) blockers.push(`${pendingDanger.length} high-risk pending approval(s)`);
  const score = utils.clampScore(100 - (blockedTasks.length * 14) - (pendingDanger.length * 12) - (criticalIncident ? 35 : 0));
  return { score, reasons: blockers.length ? blockers : ['No major project risk detected'], blockers };
}

async function scoreDeployHealth(goalId, services = {}) {
  const { snapshot } = await getSnapshotForGoal(goalId, services);
  const deploy = snapshot.latestDeployStatus || {};
  const blockers = Array.isArray(deploy.blockers) ? deploy.blockers : [];
  const score = deploy.gateOk === false ? 45 : (blockers.length ? 55 : 80);
  return { score, reasons: [`Deploy status: ${deploy.status || 'unknown'}`], blockers };
}

async function scoreIncidentHealth(goalId, services = {}) {
  const { snapshot } = await getSnapshotForGoal(goalId, services);
  const incidents = snapshot.openIncidents || [];
  const critical = incidents.filter(item => ['critical', 'high'].includes(item.severity));
  const score = utils.clampScore(100 - (critical.length * 35) - ((incidents.length - critical.length) * 14));
  return { score, reasons: incidents.length ? [`${incidents.length} open incident(s)`] : ['No open incidents'], blockers: critical.map(item => item.title) };
}

async function scoreCostHealth(goalId, services = {}) {
  const { snapshot } = await getSnapshotForGoal(goalId, services);
  const cost = snapshot.costStatus || {};
  const warnings = (cost.recommendations || []).map(item => item.reason || item.action).filter(Boolean);
  const score = cost.status === 'warning' ? 62 : (cost.status === 'unavailable' ? 70 : 84);
  return { score, reasons: warnings.length ? warnings.slice(0, 3) : [`Cost status: ${cost.status || 'ok'}`], blockers: [] };
}

async function scoreProjectHealth(goalId, services = {}) {
  const [progress, risk, deploy, incident, cost] = await Promise.all([
    scoreProgressHealth(goalId, services),
    scoreRiskHealth(goalId, services),
    scoreDeployHealth(goalId, services),
    scoreIncidentHealth(goalId, services),
    scoreCostHealth(goalId, services)
  ]);
  const blockers = [].concat(risk.blockers || [], deploy.blockers || [], incident.blockers || []);
  const critical = blockers.some(item => /secret|approval bypass|app down|critical/i.test(String(item)));
  const score = utils.clampScore((progress.score * 0.25) + (risk.score * 0.3) + (deploy.score * 0.15) + (incident.score * 0.2) + (cost.score * 0.1));
  const summary = utils.sanitize({
    goalId,
    score,
    status: statusFromScore(score, blockers, critical),
    reasons: [].concat(progress.reasons, risk.reasons, deploy.reasons, incident.reasons, cost.reasons).slice(0, 10),
    blockers: blockers.slice(0, 10),
    recommendations: buildHealthRecommendations(score, blockers),
    components: { progress, risk, deploy, incident, cost }
  });
  await utils.auditPortfolio('portfolio/project_health_scored', {
    targetType: 'goal',
    targetId: goalId,
    workspaceId: services.workspaceId,
    userId: services.userId,
    summary
  }, services);
  return summary;
}

function buildHealthRecommendations(score, blockers = []) {
  if (blockers.length) return ['Stabilkan blocker sebelum menambah fitur baru.', 'Buat proposal repair jika aksi write/external diperlukan.'];
  if (score < 75) return ['Review task stale, test coverage, dan deploy readiness.'];
  return ['Lanjutkan delivery dengan scope kecil dan tetap jalankan gate sebelum push/deploy.'];
}

async function buildProjectHealthSummary(goalId, services = {}) {
  const health = await scoreProjectHealth(goalId, services);
  return [
    `Project ${goalId}`,
    `Health: ${health.score}/100 (${health.status})`,
    `Blockers: ${health.blockers.length ? health.blockers.join('; ') : '-'}`,
    `Rekomendasi: ${health.recommendations.join(' ')}`
  ].join('\n');
}

module.exports = {
  buildProjectHealthSummary,
  scoreCostHealth,
  scoreDeployHealth,
  scoreIncidentHealth,
  scoreProgressHealth,
  scoreProjectHealth,
  scoreRiskHealth
};
