'use strict';

/**
 * V3 Planning Dashboard Routes
 * Phase 74 - AI OS v3 Planning Gate
 */

const { requireDashboardAuth } = require('./dashboard-auth');
const { sanitizeError, sanitizeOutput } = require('./dashboard-serializers');

/**
 * Register V3 planning routes
 */
function registerV3PlanningRoutes(app, services) {
  const v3PlanningStore = services.v3PlanningStore;
  const v3PlanningGate = services.v3PlanningGate;
  const v3V2LessonsCollector = services.v3V2LessonsCollector;
  const v3ScopeManager = services.v3ScopeManager;
  const v3ArchitecturePrinciples = services.v3ArchitecturePrinciples;
  const v3RiskRegister = services.v3RiskRegister;
  const v3MigrationStrategy = services.v3MigrationStrategy;
  const v3AcceptanceCriteria = services.v3AcceptanceCriteria;
  const v3DecisionLog = services.v3DecisionLog;
  const v3RoadmapBuilder = services.v3RoadmapBuilder;

  // Overview
  app.get('/api/dashboard/v3-planning', requireDashboardAuth, async (req, res) => {
    try {
      const overview = {
        gateStatus: await v3PlanningGate?.runV3PlanningGate?.(services) || { status: 'unknown' },
        lessonsCount: await v3V2LessonsCollector?.collectV2Lessons?.(services).then(l => l.lessons?.length) || 0,
        risksCount: await v3RiskRegister?.buildV3RiskReport?.(services).then(r => r.risks?.length) || 0,
        decisionsCount: await v3DecisionLog?.listV3Decisions?.({}, services).then(d => d.length) || 0,
        roadmapStatus: 'planned'
      };

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(overview),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3-planning overview'));
    }
  });

  // Run planning gate
  app.post('/api/dashboard/v3-planning/gate', requireDashboardAuth, async (req, res) => {
    try {
      const gateResult = await v3PlanningGate?.runV3PlanningGate?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        message: 'V3 planning gate executed',
        data: sanitizeOutput(gateResult),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'run v3 planning gate'));
    }
  });

  // Get V2 lessons
  app.get('/api/dashboard/v3-planning/lessons', requireDashboardAuth, async (req, res) => {
    try {
      const lessons = await v3V2LessonsCollector?.collectV2Lessons?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(lessons),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v2 lessons'));
    }
  });

  // Get V3 scope
  app.get('/api/dashboard/v3-planning/scope', requireDashboardAuth, async (req, res) => {
    try {
      const scope = await v3ScopeManager?.defineV3Scope?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(scope),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 scope'));
    }
  });

  // Get V3 principles
  app.get('/api/dashboard/v3-planning/principles', requireDashboardAuth, async (req, res) => {
    try {
      const principles = await v3ArchitecturePrinciples?.generateV3ArchitecturePrinciples?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(principles),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 principles'));
    }
  });

  // Get V3 risks
  app.get('/api/dashboard/v3-planning/risks', requireDashboardAuth, async (req, res) => {
    try {
      const risks = await v3RiskRegister?.createV3RiskRegister?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(risks),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 risks'));
    }
  });

  // Get V3 migration strategy
  app.get('/api/dashboard/v3-planning/migration', requireDashboardAuth, async (req, res) => {
    try {
      const migration = await v3MigrationStrategy?.createV3MigrationStrategy?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(migration),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 migration strategy'));
    }
  });

  // Get V3 acceptance criteria
  app.get('/api/dashboard/v3-planning/criteria', requireDashboardAuth, async (req, res) => {
    try {
      const criteria = await v3AcceptanceCriteria?.defineV3AcceptanceCriteria?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(criteria),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 acceptance criteria'));
    }
  });

  // List V3 decisions
  app.get('/api/dashboard/v3-planning/decisions', requireDashboardAuth, async (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        status: req.query.status
      };

      const decisions = await v3DecisionLog?.listV3Decisions?.(filters, services) || [];

      res.json({
        ok: true,
        status: 'success',
        data: { decisions: sanitizeOutput(decisions) },
        meta: { total: decisions.length },
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'list v3 decisions'));
    }
  });

  // Record V3 decision
  app.post('/api/dashboard/v3-planning/decisions', requireDashboardAuth, async (req, res) => {
    try {
      const decision = req.body;
      const recorded = await v3DecisionLog?.recordV3Decision?.(decision, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Decision recorded successfully',
        data: sanitizeOutput(recorded),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'record v3 decision'));
    }
  });

  // Get V3 roadmap
  app.get('/api/dashboard/v3-planning/roadmap', requireDashboardAuth, async (req, res) => {
    try {
      const roadmap = await v3RoadmapBuilder?.buildV3Roadmap?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(roadmap),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 roadmap'));
    }
  });

  // Full V3 planning report
  app.get('/api/dashboard/v3-planning/report', requireDashboardAuth, async (req, res) => {
    try {
      const report = {
        gate: await v3PlanningGate?.buildV3PlanningGateReport?.(services) || {},
        lessons: await v3V2LessonsCollector?.buildV2LessonsReport?.(services) || {},
        scope: await v3ScopeManager?.buildV3ScopeReport?.(services) || {},
        principles: await v3ArchitecturePrinciples?.buildV3PrinciplesReport?.(services) || {},
        risks: await v3RiskRegister?.buildV3RiskReport?.(services) || {},
        migration: await v3MigrationStrategy?.buildV3MigrationStrategyReport?.(services) || {},
        criteria: await v3AcceptanceCriteria?.buildV3AcceptanceCriteriaReport?.(services) || {},
        decisions: await v3DecisionLog?.summarizeV3Decisions?.(services) || {},
        roadmap: await v3RoadmapBuilder?.buildV3RoadmapReport?.(services) || {}
      };

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(report),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 planning report'));
    }
  });
}

module.exports = { registerV3PlanningRoutes };
