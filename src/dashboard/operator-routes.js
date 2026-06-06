'use strict';

const guards = require('./dashboard-guards');
const permissions = require('./dashboard-permissions');
const auditLog = require('./audit-log');

function registerOperatorRoutes(router, services = {}) {
  let operatorModule = null;
  try {
    operatorModule = require('../operator');
  } catch (e) {
    operatorModule = null;
  }

  function requireOp(orBlock) {
    if (!operatorModule) {
      if (orBlock) return orBlock();
      return { ok: false, error: 'OPERATOR_MODULE_UNAVAILABLE' };
    }
    return null;
  }

  router.get('/operator', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Operator module not loaded' }, 503));
      if (block) return;
      const ws = req.query.workspaceId || 'default';
      const goals = operatorModule.projectOperatorStore.listGoals({ workspaceId: ws, limit: 20 });
      const activeGoals = goals.filter(g => g.status !== 'shipped' && g.status !== 'archived');
      guards.safeDashboardResponse(res, { ok: true, goals, activeCount: activeGoals.length });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operator/goals', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const filters = {
        workspaceId: req.query.workspaceId || 'default',
        userId: req.query.userId || '',
        status: req.query.status || '',
        category: req.query.category || '',
        limit: parseInt(req.query.limit) || 50
      };
      const goals = operatorModule.projectOperatorStore.listGoals(filters);
      guards.safeDashboardResponse(res, { ok: true, goals });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/goals', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = operatorModule.projectGoalAnalyzer.analyzeProjectGoal(req.body);
      if (result.goal) {
        await auditLog.recordAuditLog({
          actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
          action: 'goal_created', targetType: 'goal', targetId: result.goal.id,
          workspaceId: result.goal.workspaceId, status: 'success'
        }, services);
      }
      guards.safeDashboardResponse(res, result, result.goal ? 200 : 400);
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operator/goals/:id', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const goal = operatorModule.projectOperatorStore.getGoal(req.params.id);
      if (!goal) return guards.safeDashboardResponse(res, { ok: false, error: 'Goal not found' }, 404);
      const plans = operatorModule.projectOperatorStore.listPlans(goal.id);
      const tasks = operatorModule.projectOperatorStore.listTasks({ goalId: goal.id });
      guards.safeDashboardResponse(res, { ok: true, goal, plans, tasks });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/goals/:id/analyze', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const goal = operatorModule.projectOperatorStore.getGoal(req.params.id);
      if (!goal) return guards.safeDashboardResponse(res, { ok: false, error: 'Goal not found' }, 404);
      const analysis = operatorModule.projectGoalAnalyzer.analyzeProjectGoal(goal);
      guards.safeDashboardResponse(res, { ok: true, analysis: analysis.analysis });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/goals/:id/plan', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = operatorModule.operatorPlanner.createOperatorPlan(req.params.id);
      if (result.ok) {
        await auditLog.recordAuditLog({
          actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
          action: 'plan_created', targetType: 'plan', targetId: result.plan.id,
          workspaceId: result.plan.workspaceId, status: 'success'
        }, services);
      }
      guards.safeDashboardResponse(res, result, result.ok ? 200 : 400);
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/plans/:id/tasks', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = operatorModule.operatorTaskBreakdown.breakPlanIntoTasks(req.params.id);
      if (result.ok) {
        await auditLog.recordAuditLog({
          actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
          action: 'tasks_created', targetType: 'plan', targetId: req.params.id,
          status: 'success'
        }, services);
      }
      guards.safeDashboardResponse(res, result, result.ok ? 200 : 400);
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operator/tasks', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const filters = {
        goalId: req.query.goalId || '',
        planId: req.query.planId || '',
        status: req.query.status || '',
        type: req.query.type || '',
        limit: parseInt(req.query.limit) || 50
      };
      const tasks = operatorModule.projectOperatorStore.listTasks(filters);
      guards.safeDashboardResponse(res, { ok: true, tasks });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/tasks/:id/run-review', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const task = operatorModule.projectOperatorStore.getTask(req.params.id);
      if (!task) return guards.safeDashboardResponse(res, { ok: false, error: 'Task not found' }, 404);
      const riskReview = operatorModule.operatorRiskReview.reviewOperatorPlanRisk({ id: task.planId, phases: [], summary: task.description || '' });
      const coord = operatorModule.operatorAgentCoordinator.synthesizeAgentResult(task);
      guards.safeDashboardResponse(res, { ok: true, riskReview, agentSynthesis: coord });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/tasks/:id/evaluate', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const task = operatorModule.projectOperatorStore.getTask(req.params.id);
      if (!task) return guards.safeDashboardResponse(res, { ok: false, error: 'Task not found' }, 404);
      const evalResult = operatorModule.operatorEvaluationGate.runOperatorEvaluationGate(task);
      const report = operatorModule.operatorEvaluationGate.buildOperatorGateReport(evalResult);
      guards.safeDashboardResponse(res, { ok: true, evaluation: evalResult, report });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operator/tasks/:id/create-proposal', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const task = operatorModule.projectOperatorStore.getTask(req.params.id);
      if (!task) return guards.safeDashboardResponse(res, { ok: false, error: 'Task not found' }, 404);
      const evalResult = operatorModule.operatorEvaluationGate.runOperatorEvaluationGate(task);
      if (!evalResult.ok) {
        return guards.safeDashboardResponse(res, { ok: false, error: 'Evaluation gate failed', evaluation: evalResult }, 400);
      }
      const actionPlan = operatorModule.operatorProposalBridge.createOperatorActionPlan(task);
      if (!actionPlan.ok) return guards.safeDashboardResponse(res, actionPlan, 400);
      const proposal = operatorModule.operatorProposalBridge.createOperatorExecutorProposal(actionPlan.actionPlan);
      operatorModule.operatorProposalBridge.linkOperatorProposal(task.id, proposal.proposal.id);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'proposal_created', targetType: 'proposal', targetId: proposal.proposal.id,
        workspaceId: '', status: 'success'
      }, services);
      guards.safeDashboardResponse(res, { ok: true, actionPlan: actionPlan.actionPlan, proposal: proposal.proposal, evaluation: evalResult });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operator/goals/:id/progress', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const progress = operatorModule.operatorProgressTracker.calculateProgress(req.params.id);
      const blocked = operatorModule.operatorProgressTracker.detectBlockedProgress(req.params.id);
      const stale = operatorModule.operatorProgressTracker.detectStaleTasks(req.params.id);
      guards.safeDashboardResponse(res, { ok: true, progress, blocked, stale });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operator/goals/:id/report', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const report = operatorModule.operatorReportGenerator.generateProjectStatusReport(req.params.id);
      guards.safeDashboardResponse(res, { ok: true, report });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operator/goals/:id/next-action', async (req, res) => {
    try {
      const block = requireOp(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const decision = operatorModule.operatorDecisionEngine.recommendNextOperatorAction(req.params.id);
      guards.safeDashboardResponse(res, { ok: true, decision });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });
}

module.exports = { registerOperatorRoutes };
