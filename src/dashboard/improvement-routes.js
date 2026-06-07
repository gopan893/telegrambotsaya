'use strict';

const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const auditLog = require('./audit-log');
const permissions = require('./dashboard-permissions');

function registerImprovementRoutes(router, services = {}) {
  let improvement;
  try {
    improvement = require('../improvement');
  } catch (e) {
    improvement = null;
  }

  function requireImprovement(orBlock) {
    if (!improvement) {
      if (orBlock) return orBlock();
      return { ok: false, error: 'IMPROVEMENT_MODULE_UNAVAILABLE' };
    }
    return null;
  }

  const svc = { store: improvement, ...services };

  router.get('/improvement', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, {
        ok: true, feedback: 0, outcomes: 0, weaknesses: 0, lessons: 0, plans: 0
      }));
      if (block) return;
      const stats = improvement.store.getStats ? improvement.store.getStats() : {};
      guards.safeDashboardResponse(res, {
        ok: true,
        feedback: stats.feedback || 0,
        outcomes: stats.outcomes || 0,
        weaknesses: stats.weaknesses || 0,
        lessons: stats.lessons || 0,
        plans: stats.plans || 0
      });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/feedback', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.category) filters.category = req.query.category;
      const data = improvement.store.getAll ? improvement.store.getAll('feedback') : [];
      const filtered = data.filter(item => {
        if (filters.status && item.status !== filters.status) return false;
        if (filters.category && item.category !== filters.category) return false;
        return true;
      });
      guards.safeDashboardResponse(res, { ok: true, data: filtered, total: filtered.length });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/feedback', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const text = String(req.body.text || '').trim();
      if (!text) return guards.safeDashboardResponse(res, { ok: false, error: 'FEEDBACK_TEXT_REQUIRED' }, 400);
      const sanitized = improvement.utils ? improvement.utils.sanitizeImprovementText(text) : text;
      const category = improvement.feedback ? improvement.feedback.autoClassifyCategory(sanitized) : 'answer_quality';
      const feedback = improvement.feedback ? improvement.feedback.collectDashboardFeedback({ text: sanitized, category, source: 'dashboard' }, svc) : null;
      if (!feedback) return guards.safeDashboardResponse(res, { ok: false, error: 'FEEDBACK_CREATE_FAILED' }, 500);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'feedback_submitted', targetType: 'improvement_feedback', targetId: feedback.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: feedback });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/outcomes', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const filters = {};
      if (req.query.type) filters.type = req.query.type;
      if (req.query.status) filters.status = req.query.status;
      const data = improvement.outcomes ? improvement.outcomes.getOutcomes(filters) : (improvement.store.getAll ? improvement.store.getAll('outcomes') : []);
      const total = Array.isArray(data) ? data.length : 0;
      guards.safeDashboardResponse(res, { ok: true, data: Array.isArray(data) ? data : [], total });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/outcomes', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const outcome = improvement.store.add ? improvement.store.add('outcomes', {
        ...req.body,
        source: req.body.source || 'dashboard',
        createdAt: new Date().toISOString()
      }) : null;
      if (!outcome) return guards.safeDashboardResponse(res, { ok: false, error: 'OUTCOME_CREATE_FAILED' }, 500);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'outcome_submitted', targetType: 'improvement_outcome', targetId: outcome.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: outcome });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/weaknesses', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const data = improvement.store.getAll ? improvement.store.getAll('weaknesses') : [];
      const total = data.length;
      guards.safeDashboardResponse(res, { ok: true, data, total });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/weaknesses/:id/lesson', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = improvement.lessons ? await improvement.lessons.createLessonFromWeakness(req.params.id, svc) : null;
      if (!result || !result.ok) return guards.safeDashboardResponse(res, { ok: false, error: (result && result.reason) || 'LESSON_CREATE_FAILED' }, 400);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'lesson_created_from_weakness', targetType: 'improvement_weakness', targetId: req.params.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: result.lesson });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/patterns', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const data = improvement.patterns ? await improvement.patterns.analyzeImprovementPatterns({}, svc) : [];
      const total = Array.isArray(data) ? data.length : 0;
      guards.safeDashboardResponse(res, { ok: true, data: Array.isArray(data) ? data : [], total });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/lessons', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const query = req.query.q || '';
      const data = query ? (improvement.lessons ? await improvement.lessons.searchLessons(query, svc) : []) : (improvement.store.getAll ? improvement.store.getAll('lessons') : []);
      const total = Array.isArray(data) ? data.length : 0;
      guards.safeDashboardResponse(res, { ok: true, data: Array.isArray(data) ? data : [], total });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/lessons', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = improvement.lessons ? await improvement.lessons.createLesson(req.body, svc) : null;
      if (!result || !result.ok) return guards.safeDashboardResponse(res, { ok: false, error: (result && result.reason) || 'LESSON_CREATE_FAILED' }, 400);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'lesson_created', targetType: 'improvement_lesson', targetId: result.lesson.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: result.lesson });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/regression-cases', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], suggestions: [], total: 0 }));
      if (block) return;
      const data = improvement.store.getAll ? improvement.store.getAll('regressionCases') : [];
      const cases = Array.isArray(data) ? data : [];
      const allWeaknesses = improvement.store.getAll ? improvement.store.getAll('weaknesses') : [];
      const suggestions = (Array.isArray(allWeaknesses) ? allWeaknesses : []).filter(w => w.status === 'open').map(w => ({
        weaknessId: w.id,
        title: w.title,
        module: w.module || 'unknown'
      }));
      guards.safeDashboardResponse(res, { ok: true, data: cases, suggestions, total: cases.length });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/regression-cases', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const weaknessId = req.body.weaknessId || req.body.sourceWeaknessId;
      if (!weaknessId) return guards.safeDashboardResponse(res, { ok: false, error: 'WEAKNESS_ID_REQUIRED' }, 400);
      const caseItem = improvement.regression ? improvement.regression.generateRegressionCaseFromWeakness(weaknessId, svc) : null;
      if (!caseItem) return guards.safeDashboardResponse(res, { ok: false, error: 'REGRESSION_CASE_GENERATE_FAILED' }, 500);
      if (improvement.store.add) improvement.store.add('regressionCases', caseItem);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'regression_case_generated', targetType: 'improvement_regression_case', targetId: caseItem.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: caseItem });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/plans', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const data = improvement.store.getAll ? improvement.store.getAll('plans') : [];
      const total = data.length;
      guards.safeDashboardResponse(res, { ok: true, data, total });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/plans', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const plan = improvement.plans ? improvement.plans.createImprovementPlan(req.body, svc) : null;
      if (!plan) return guards.safeDashboardResponse(res, { ok: false, error: 'PLAN_CREATE_FAILED' }, 500);
      if (improvement.store.add) improvement.store.add('plans', plan);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'improvement_plan_created', targetType: 'improvement_plan', targetId: plan.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: plan });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/plans/:id/prompt', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const agent = req.body.agent || 'codex';
      let prompt;
      if (agent === 'opencode') {
        prompt = improvement.prompts ? improvement.prompts.generateOpenCodeImprovementPrompt(req.params.id, svc) : null;
      } else if (agent === 'hermes') {
        prompt = improvement.prompts ? improvement.prompts.generateHermesImprovementPrompt(req.params.id, svc) : null;
      } else if (agent === 'security') {
        prompt = improvement.prompts ? improvement.prompts.generateSecurityReviewPrompt(req.params.id, svc) : null;
      } else if (agent === 'regression') {
        prompt = improvement.prompts ? improvement.prompts.generateRegressionTestPrompt(req.params.id, svc) : null;
      } else {
        prompt = improvement.prompts ? improvement.prompts.generateCodexImprovementPrompt(req.params.id, svc) : null;
      }
      if (!prompt) return guards.safeDashboardResponse(res, { ok: false, error: 'PROMPT_GENERATE_FAILED' }, 500);
      guards.safeDashboardResponse(res, { ok: true, data: prompt });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/improvement/plans/:id/proposal', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const planData = improvement.store.getById ? improvement.store.getById('plans', req.params.id) : null;
      if (!planData) return guards.safeDashboardResponse(res, { ok: false, error: 'PLAN_NOT_FOUND' }, 404);
      const actionPlan = improvement.proposals ? improvement.proposals.createImprovementActionPlan(planData, svc) : null;
      if (!actionPlan) return guards.safeDashboardResponse(res, { ok: false, error: 'ACTION_PLAN_CREATE_FAILED' }, 500);
      const proposal = improvement.proposals ? improvement.proposals.createImprovementExecutorProposal(actionPlan, svc) : null;
      if (!proposal) return guards.safeDashboardResponse(res, { ok: false, error: 'PROPOSAL_CREATE_FAILED' }, 500);
      if (improvement.proposals) improvement.proposals.linkImprovementPlanToProposal(req.params.id, proposal.id, svc);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'proposal_created_from_plan', targetType: 'improvement_plan', targetId: req.params.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, data: { actionPlan, proposal } });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/improvement/report', async (req, res) => {
    try {
      const block = requireImprovement(() => guards.safeDashboardResponse(res, { ok: true, data: { title: 'Improvement Report', sections: [], generatedAt: new Date().toISOString() } }));
      if (block) return;
      const workspaceId = req.query.workspaceId || '';
      const report = improvement.reports ? improvement.reports.generateImprovementSummary(workspaceId, svc) : null;
      if (!report) return guards.safeDashboardResponse(res, { ok: false, error: 'REPORT_GENERATE_FAILED' }, 500);
      guards.safeDashboardResponse(res, { ok: true, data: report });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });
}

module.exports = { registerImprovementRoutes };
