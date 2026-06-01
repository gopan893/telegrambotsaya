'use strict';

const utils = require('./backup-utils');

async function read(key, fallback, services = {}) {
  return services.storageManager?.safeRead ? services.storageManager.safeRead(key, fallback) : fallback;
}

function flattenUserBucket(bucket = {}) {
  if (Array.isArray(bucket)) return bucket;
  if (!bucket || typeof bucket !== 'object') return [];
  return Object.values(bucket).flatMap(value => Array.isArray(value) ? value : (value && typeof value === 'object' ? flattenUserBucket(value) : []));
}

async function checkWorkspaceReferences(services = {}) {
  const workspaces = await read('workspaces', [], services);
  const issues = [];
  for (const workspace of Array.isArray(workspaces) ? workspaces : []) {
    if (!workspace.id) issues.push({ type: 'workspace_missing_id', item: workspace.name || '' });
    if (!workspace.ownerId) issues.push({ type: 'workspace_missing_owner', item: workspace.id || '' });
  }
  return { ok: issues.length === 0, issues, workspaceIds: new Set((workspaces || []).map(item => item.id).filter(Boolean)) };
}

async function checkMemoryReferences(services = {}) {
  const memories = flattenUserBucket(await read('aios_memories', {}, services));
  const issues = memories.filter(item => !utils.getItemUserId(item)).map(item => ({ type: 'memory_missing_userId', item: item.id || '' }));
  return { ok: issues.length === 0, issues };
}

async function checkGoalWorkflowLinks(services = {}) {
  const goals = flattenUserBucket(await read('aios_goals', {}, services));
  const workflows = flattenUserBucket(await read('aios_workflows', {}, services));
  const goalIds = new Set(goals.map(goal => goal.id).filter(Boolean));
  const issues = [];
  for (const workflow of workflows) {
    const goalId = workflow.goalId || workflow.goal_id;
    if (goalId && !goalIds.has(goalId)) issues.push({ type: 'workflow_broken_goal_link', item: workflow.id || '', linkedGoalId: goalId });
  }
  return { ok: issues.length === 0, issues };
}

async function checkGraphReferences(services = {}) {
  const nodes = flattenUserBucket(await read('aios_graph_nodes', {}, services));
  const edges = flattenUserBucket(await read('aios_graph_edges', {}, services));
  const nodeIds = new Set(nodes.map(node => node.id).filter(Boolean));
  const issues = [];
  for (const edge of edges) {
    const from = edge.from || edge.fromNodeId || edge.from_node_id;
    const to = edge.to || edge.toNodeId || edge.to_node_id;
    if ((from && !nodeIds.has(from)) || (to && !nodeIds.has(to))) {
      issues.push({ type: 'graph_edge_missing_node', item: edge.id || '', from, to });
    }
  }
  return { ok: issues.length === 0, issues };
}

async function checkPlannerTaskLinks(services = {}) {
  const plans = await read('planner_sessions', [], services);
  const tasks = await read('planner_tasks', [], services);
  const planIds = new Set((Array.isArray(plans) ? plans : []).map(plan => plan.id).filter(Boolean));
  const issues = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task.planId && !planIds.has(task.planId)) issues.push({ type: 'planner_task_missing_plan', item: task.id || '', planId: task.planId });
  }
  return { ok: issues.length === 0, issues };
}

async function checkExecutorProposalLinks(services = {}) {
  const proposals = await read('executor_proposals', [], services);
  const issues = [];
  for (const proposal of Array.isArray(proposals) ? proposals : []) {
    if (!proposal.sourceType || !proposal.sourceId) issues.push({ type: 'executor_proposal_missing_source', item: proposal.id || '' });
  }
  return { ok: issues.length === 0, issues };
}

function buildIntegrityReport(result = {}) {
  const checks = result.checks || {};
  const issues = Object.values(checks).flatMap(check => check.issues || []);
  return utils.sanitize({
    ok: issues.length === 0,
    issueCount: issues.length,
    checks: Object.fromEntries(Object.entries(checks).map(([key, check]) => [key, { ok: check.ok, issueCount: (check.issues || []).length }])),
    issues: issues.slice(0, 50),
    generatedAt: result.generatedAt || utils.nowIso()
  });
}

async function runIntegrityCheck(scope = {}, services = {}) {
  const checks = {
    workspaces: await checkWorkspaceReferences(services),
    memories: await checkMemoryReferences(services),
    goalWorkflowLinks: await checkGoalWorkflowLinks(services),
    graphReferences: await checkGraphReferences(services),
    plannerTaskLinks: await checkPlannerTaskLinks(services),
    executorProposalLinks: await checkExecutorProposalLinks(services)
  };
  return buildIntegrityReport({ scope, checks, generatedAt: utils.nowIso() });
}

module.exports = {
  buildIntegrityReport,
  checkExecutorProposalLinks,
  checkGoalWorkflowLinks,
  checkGraphReferences,
  checkMemoryReferences,
  checkPlannerTaskLinks,
  checkWorkspaceReferences,
  runIntegrityCheck
};
