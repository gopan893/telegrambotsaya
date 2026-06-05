'use strict';

const policy = require('./autoheal-policy');
const utils = require('./autoheal-utils');

function createRunner(store, actions, services) {
  async function runAutoHeal(actionId, ctx) {
    const action = await store.getAction(actionId);
    if (!action) return { ok: false, error: 'Action not found' };

    const decision = policy.canRunAutoHeal(action, ctx);
    if (!decision.ok) {
      if (decision.proposalRequired) {
        const plan = await createProposalOnly(action, ctx);
        return { ok: true, status: 'proposal_created', planId: plan?.id, reason: decision.reason };
      }
      return { ok: false, error: decision.reason };
    }

    const today = new Date().toISOString().slice(0, 10);
    const allRuns = await store.getRuns({ actionId: action.id });
    const todayRuns = allRuns.filter(r => r.createdAt?.startsWith(today));
    const recentRuns = allRuns.slice(-10);

    const cd = policy.enforceCooldown(action, recentRuns);
    if (!cd.ok) return { ok: false, error: cd.reason, remaining: cd.remaining };

    const rl = policy.enforceRateLimit(action, todayRuns);
    if (!rl.ok) return { ok: false, error: rl.reason, max: rl.max };

    const run = { id: utils.generateId('ahr'), actionId: action.id, workspaceId: ctx.workspaceId || '', trigger: ctx.trigger || 'manual', status: 'running', level: action.level, riskLevel: action.riskLevel, startedAt: utils.nowISO() };
    await store.saveRun(run);

    try {
      const result = await actions.runAction(action, ctx);
      run.status = result.ok ? 'completed' : 'failed';
      run.summary = result.summary || '';
      run.findings = result.details || '';
      run.completedAt = utils.nowISO();
      await store.saveRun(run);
      return { ok: result.ok, status: run.status, summary: run.summary, runId: run.id };
    } catch (err) {
      run.status = 'failed';
      run.summary = err.message;
      run.completedAt = utils.nowISO();
      await store.saveRun(run);
      return { ok: false, error: err.message, runId: run.id };
    }
  }

  async function createProposalOnly(action, ctx) {
    if (services.selfHealingSystem) {
      const plan = await services.selfHealingSystem.repairPlanGenerator.createDashboardRepairPlan(
        { summary: 'Auto-healing proposal: ' + action.name }, ctx
      );
      await store.saveProposal({ actionId: action.id, repairPlanId: plan.id, status: 'proposal_created' });
      return plan;
    }
    return null;
  }

  return { runAutoHeal };
}

module.exports = { createRunner };
