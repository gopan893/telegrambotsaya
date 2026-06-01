'use strict';

const executor = require('../executor');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const workspaceRoutes = require('./workspace-routes');

function actorFromReq(req, services = {}) {
  return workspaceRoutes.getActorId(req, services);
}

function userFromReq(req, services = {}) {
  return guards.validateUserId(req.body?.userId || req.query?.userId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '') || '';
}

function workspaceFromReq(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || '').trim();
}

function buildServices(req, services = {}) {
  return {
    ...services,
    actorId: actorFromReq(req, services),
    actorType: 'dashboard',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

function sendResult(res, result, status = 200) {
  const code = result?.status || status;
  if (result?.ok === false) {
    return guards.safeDashboardResponse(res, { ok: false, error: result.reason || result.error || 'EXECUTOR_ERROR' }, code >= 400 ? code : 400);
  }
  return guards.safeDashboardResponse(res, result, code);
}

function registerExecutorRoutes(router, services = {}) {
  router.get('/executor', async (req, res) => {
    const userId = userFromReq(req, services);
    const workspaceId = await executor.executorUtils.resolveWorkspaceId(userId, workspaceFromReq(req), buildServices(req, services));
    const access = await executor.executorGuards.enforceExecutionPermission({
      actorId: actorFromReq(req, services),
      userId,
      workspaceId,
      permission: 'read',
      riskLevel: 'low',
      action: 'executor/list'
    }, buildServices(req, services));
    if (!access.ok) return guards.safeDashboardResponse(res, { ok: false, error: access.error }, 403);
    const items = await executor.executionStore.listExecutionItems(executor.executionStore.EXECUTOR_PROPOSALS_KEY, {
      userId: access.userId,
      workspaceId: access.workspaceId,
      status: req.query.status || '',
      riskLevel: req.query.riskLevel || '',
      sourceType: req.query.sourceType || '',
      limit: guards.validateLimit(req.query.limit, 50, 100),
      includeExpired: req.query.includeExpired === 'true'
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizeExecutionProposal) });
  });

  router.get('/executor/pending', async (req, res) => {
    const userId = userFromReq(req, services);
    const items = await executor.executionQueue.listPendingApprovals({
      userId,
      actorId: actorFromReq(req, services),
      workspaceId: workspaceFromReq(req),
      limit: guards.validateLimit(req.query.limit, 50, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizeExecutionProposal) });
  });

  router.get('/executor/runs', async (req, res) => {
    const userId = userFromReq(req, services);
    const items = await executor.executionStore.listExecutionItems(executor.executionStore.EXECUTOR_RUNS_KEY, {
      userId,
      workspaceId: workspaceFromReq(req),
      status: req.query.status || '',
      limit: guards.validateLimit(req.query.limit, 50, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizeExecutionRun) });
  });

  router.post('/executor/propose', async (req, res) => {
    const result = await executor.executionPlanner.createExecutionProposal({
      ...req.body,
      actorId: actorFromReq(req, services),
      userId: userFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.post('/executor/propose/from-task', async (req, res) => {
    const taskId = guards.validateId(req.body?.taskId || req.query?.taskId || '');
    if (!taskId) return guards.safeDashboardResponse(res, { ok: false, error: 'TASK_ID_REQUIRED' }, 400);
    const result = await executor.executionPlanner.proposeFromPlannerTask(taskId, {
      ...req.body,
      actorId: actorFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.post('/executor/propose/from-goal', async (req, res) => {
    const goalId = guards.validateId(req.body?.goalId || req.query?.goalId || '');
    if (!goalId) return guards.safeDashboardResponse(res, { ok: false, error: 'GOAL_ID_REQUIRED' }, 400);
    const result = await executor.executionPlanner.proposeFromGoal(goalId, {
      ...req.body,
      actorId: actorFromReq(req, services),
      userId: userFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.post('/executor/propose/from-workflow', async (req, res) => {
    const workflowId = guards.validateId(req.body?.workflowId || req.query?.workflowId || '');
    if (!workflowId) return guards.safeDashboardResponse(res, { ok: false, error: 'WORKFLOW_ID_REQUIRED' }, 400);
    const result = await executor.executionPlanner.proposeFromWorkflow(workflowId, {
      ...req.body,
      actorId: actorFromReq(req, services),
      userId: userFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.get('/executor/:proposalId', async (req, res) => {
    const proposalId = guards.validateId(req.params.proposalId);
    if (!proposalId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_PROPOSAL_ID' }, 400);
    const status = await executor.executionQueue.getApprovalStatus(proposalId, buildServices(req, services));
    if (!status.ok) return sendResult(res, status, status.status || 404);
    const access = await executor.executorGuards.enforceWorkspaceExecutionAccess(status.proposal, buildServices(req, services), 'read');
    if (!access.ok) return guards.safeDashboardResponse(res, { ok: false, error: access.error }, 403);
    return guards.safeDashboardResponse(res, { ok: true, proposal: serializers.sanitizeExecutionProposal(status.proposal) });
  });

  router.post('/executor/:proposalId/approve', async (req, res) => {
    const result = await executor.executionQueue.approveExecution(req.params.proposalId, actorFromReq(req, services), buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.post('/executor/:proposalId/reject', async (req, res) => {
    const result = await executor.executionQueue.rejectExecution(req.params.proposalId, actorFromReq(req, services), req.body?.reason || '', buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.post('/executor/:proposalId/cancel', async (req, res) => {
    const result = await executor.executionQueue.cancelExecution(req.params.proposalId, actorFromReq(req, services), buildServices(req, services));
    return sendResult(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : result, result.status || 200);
  });

  router.post('/executor/:proposalId/run', async (req, res) => {
    const result = await executor.approvedRunner.runApprovedExecution(req.params.proposalId, buildServices(req, services));
    return sendResult(res, result.ok ? {
      ok: true,
      proposal: serializers.sanitizeExecutionProposal(result.proposal),
      run: serializers.sanitizeExecutionRun(result.run),
      actionResults: result.actionResults
    } : result, result.status || 200);
  });
}

module.exports = {
  registerExecutorRoutes
};
