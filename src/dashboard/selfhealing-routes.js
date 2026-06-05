'use strict';

const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');

function registerSelfHealingRoutes(router, services = {}) {
  const selfHealing = services.selfHealingSystem;
  if (!selfHealing) return;

  const { store, repairPlanGenerator, repairPromptGenerator, repairProposalBridge } = selfHealing;

  async function ensureAccess(req, res, level) {
    return true;
  }

  router.get('/selfhealing', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    return guards.safeDashboardResponse(res, {
      ok: true,
      initialized: true,
      guardCount: (await store.getGuards()).length,
      guards: (await store.getGuards()).map(g => ({
        id: g.id, name: g.name, category: g.category, severity: g.severity, enabled: g.enabled
      }))
    });
  });

  router.get('/selfhealing/guards', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const guards_ = await store.getGuards();
    return guards.safeDashboardResponse(res, { ok: true, guards: serializers.sanitizeStorage(guards_) });
  });

  router.post('/selfhealing/run', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const { category, severity, enabled } = req.body || {};
    const filters = {};
    if (category) filters.category = category;
    if (severity) filters.severity = severity;
    if (enabled !== undefined) filters.enabled = enabled;
    const result = Object.keys(filters).length > 0
      ? await selfHealing.healthCheckSuite.runHealthCheckSuite(filters, { workspaceId: req.body?.workspaceId || '' })
      : await selfHealing.runAllChecks({ workspaceId: req.body?.workspaceId || '' });
    return guards.safeDashboardResponse(res, { ok: true, ...result });
  });

  router.post('/selfhealing/guards/:id/run', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const guardId = String(req.params.id || '').trim();
    const result = await selfHealing.runGuardById(guardId, { workspaceId: req.body?.workspaceId || '' });
    if (!result) return guards.safeDashboardResponse(res, { ok: false, error: 'Guard not found' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, result });
  });

  router.get('/selfhealing/results', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const filter = {};
    if (req.query.guardId) filter.guardId = req.query.guardId;
    if (req.query.status) filter.status = req.query.status;
    const results = await store.getRuns(Object.keys(filter).length > 0 ? filter : null);
    return guards.safeDashboardResponse(res, { ok: true, results: results.slice(-50).reverse() });
  });

  router.get('/selfhealing/results/:id', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const id = String(req.params.id || '').trim();
    const results = await store.getRuns({ id });
    return guards.safeDashboardResponse(res, { ok: true, result: results[0] || null });
  });

  router.get('/selfhealing/repair-plans', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const plans = await store.getRepairPlans(Object.keys(filter).length > 0 ? filter : null);
    return guards.safeDashboardResponse(res, { ok: true, plans: plans.slice(-50).reverse() });
  });

  router.post('/selfhealing/repair-plans', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const { runId } = req.body || {};
    if (!runId) return guards.safeDashboardResponse(res, { ok: false, error: 'runId required' }, 400);
    const runs = await store.getRuns({ id: runId });
    const run = runs[0];
    if (!run) return guards.safeDashboardResponse(res, { ok: false, error: 'Run not found' }, 404);
    const plan = await selfHealing.createRepairPlanFromResult(run, { workspaceId: req.body?.workspaceId || '', userId: req.body?.userId || '' });
    return guards.safeDashboardResponse(res, { ok: true, plan });
  });

  router.get('/selfhealing/repair-plans/:id', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const plan = await store.getRepairPlan(String(req.params.id || '').trim());
    if (!plan) return guards.safeDashboardResponse(res, { ok: false, error: 'Plan not found' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, plan });
  });

  router.post('/selfhealing/repair-plans/:id/generate-prompt', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const plan = await store.getRepairPlan(String(req.params.id || '').trim());
    if (!plan) return guards.safeDashboardResponse(res, { ok: false, error: 'Plan not found' }, 404);
    const promptType = String(req.body?.type || 'codex').toLowerCase();
    let prompt = '';
    if (promptType === 'codex') prompt = repairPromptGenerator.generateCodexRepairPrompt(plan);
    else if (promptType === 'hermes') prompt = repairPromptGenerator.generateHermesRepairPrompt(plan);
    else if (promptType === 'compact') prompt = repairPromptGenerator.generateCompactRepairPrompt(plan);
    else if (promptType === 'p0') prompt = repairPromptGenerator.generateP0OnlyRepairPrompt(plan);
    else return guards.safeDashboardResponse(res, { ok: false, error: 'Unknown prompt type: ' + promptType }, 400);
    plan.codexPrompt = prompt;
    plan.status = 'prompt_ready';
    await store.saveRepairPlan(plan);
    await store.savePrompt({ repairPlanId: plan.id, type: promptType, prompt });
    return guards.safeDashboardResponse(res, { ok: true, prompt });
  });

  router.post('/selfhealing/repair-plans/:id/create-proposal', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const planId = String(req.params.id || '').trim();
    const result = await repairProposalBridge.createRepairExecutorProposal(planId, {
      workspaceId: req.body?.workspaceId || '',
      userId: req.body?.userId || '',
      evaluationSystem: services.evaluationSystem
    });
    return guards.safeDashboardResponse(res, { ok: result.ok, ...result });
  });
}

module.exports = { registerSelfHealingRoutes };
