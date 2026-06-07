'use strict';

const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

function inferDependenciesForText(text = '') {
  const lower = String(text || '').toLowerCase();
  const deps = [];
  if (/deploy|render|release|rollback/.test(lower)) deps.push('tests_pass', 'secret_scan_pass', 'release_gate_pass');
  if (/push|github|commit|pr/.test(lower)) deps.push('secret_scan_pass', 'evaluation_v2_pass');
  if (/automation|routine|executor|auto/.test(lower)) deps.push('executor_approval_safety');
  if (/portfolio|operator|project/.test(lower)) deps.push('operator_foundation_available');
  if (/dashboard|ui|menu|pwa/.test(lower)) deps.push('dashboard_route_stability');
  return utils.uniqueList(deps, 12);
}

async function detectTaskDependencies(goalId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const tasks = (snapshot.openTasks || []).filter(task => !goalId || String(task.linkedGoalId) === String(goalId));
  return tasks.map(task => ({
    taskId: task.id,
    goalId: task.linkedGoalId || goalId || '',
    dependencies: utils.uniqueList([...(task.dependencies || []), ...inferDependenciesForText(`${task.title} ${task.description || ''}`)], 20),
    blocked: task.status === 'blocked',
    blockerReason: task.blockedReason || ''
  }));
}

async function detectProjectDependencies(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const nodes = snapshot.activeGoals || [];
  const edges = [];
  for (const goal of nodes) {
    for (const dep of inferDependenciesForText(`${goal.title} ${goal.description}`)) {
      edges.push({
        from: goal.id,
        to: dep,
        type: 'requires',
        confidence: 0.68,
        evidence: `Heuristic dependency from project text: ${goal.title}`
      });
    }
  }
  if ((snapshot.openIncidents || []).length) {
    for (const goal of nodes) {
      edges.push({ from: 'incident_response', to: goal.id, type: 'blocks', confidence: 0.72, evidence: 'Open incident affects portfolio priority.' });
    }
  }
  await utils.auditPortfolio('portfolio/dependency_detected', {
    workspaceId: snapshot.workspaceId,
    userId: services.userId,
    summary: { edges: edges.length }
  }, services);
  return utils.sanitize({ ok: true, workspaceId: snapshot.workspaceId, nodes, edges });
}

async function detectBlockingProjects(goalId, services = {}) {
  const deps = await detectTaskDependencies(goalId, services);
  return deps.filter(item => item.blocked || item.dependencies.length).slice(0, 20);
}

async function detectUnsafeOrdering(projects = [], services = {}) {
  const warnings = [];
  for (const project of projects || []) {
    const text = `${project.goal?.title || project.title || ''} ${project.recommendation || ''}`.toLowerCase();
    if (/deploy|push/.test(text) && !/test|secret|gate/.test(text)) {
      warnings.push({ projectId: project.goalId || project.id, warning: 'Push/deploy should wait for tests, secret scan, Evaluation v2, and executor approval.' });
    }
  }
  return utils.sanitize({ ok: true, warnings });
}

async function buildDependencyGraph(workspaceId, services = {}) {
  return detectProjectDependencies(workspaceId, services);
}

module.exports = {
  buildDependencyGraph,
  detectBlockingProjects,
  detectProjectDependencies,
  detectTaskDependencies,
  detectUnsafeOrdering
};
