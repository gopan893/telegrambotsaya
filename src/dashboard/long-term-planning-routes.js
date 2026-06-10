'use strict';

/**
 * Long-Term Planning Dashboard Routes
 * Phase 73 - AI OS Long-Term Autonomous Planning v2
 */

const { requireDashboardAuth } = require('./dashboard-auth');
const { sanitizeError, sanitizeOutput } = require('./dashboard-serializers');

/**
 * Register long-term planning routes
 */
function registerLongTermPlanningRoutes(app, services) {
  const planningStore = services.planningStore;
  const goalRegistry = services.goalRegistry;
  const milestoneManager = services.milestoneManager;
  const roadmapBuilder = services.roadmapBuilder;
  const priorityRecalculator = services.priorityRecalculator;
  const blockerDetector = services.blockerDetector;
  const progressReviewer = services.progressReviewer;
  const resourceEstimator = services.resourceEstimator;
  const strategyRecommender = services.strategyRecommender;
  const planningReportGenerator = services.planningReportGenerator;
  const planningProposalBridge = services.planningProposalBridge;
  const planningWorkflowBridge = services.planningWorkflowBridge;

  // Overview
  app.get('/api/dashboard/long-term-planning', requireDashboardAuth, async (req, res) => {
    try {
      const overview = {
        activeGoals: await goalRegistry?.listGoals?.({ status: 'active' }, services) || [],
        weeklyFocus: await roadmapBuilder?.buildWeeklyRoadmap?.(services) || {},
        upcomingMilestones: await milestoneManager?.listMilestones?.('upcoming', services) || [],
        blockers: await blockerDetector?.detectProjectBlockers?.(services) || [],
        recommendations: await strategyRecommender?.recommendNextStrategicActions?.(services) || []
      };

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(overview),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'long-term-planning overview'));
    }
  });

  // List goals
  app.get('/api/dashboard/long-term-planning/goals', requireDashboardAuth, async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        category: req.query.category,
        horizon: req.query.horizon,
        workspaceId: req.query.workspaceId
      };

      const goals = await goalRegistry?.listGoals?.(filters, services) || [];

      res.json({
        ok: true,
        status: 'success',
        data: { goals: sanitizeOutput(goals) },
        meta: { total: goals.length },
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'list goals'));
    }
  });

  // Create goal
  app.post('/api/dashboard/long-term-planning/goals', requireDashboardAuth, async (req, res) => {
    try {
      const input = req.body;
      const goal = await goalRegistry?.createGoal?.(input, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Goal created successfully',
        data: sanitizeOutput(goal),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'create goal'));
    }
  });

  // Get goal details
  app.get('/api/dashboard/long-term-planning/goals/:id', requireDashboardAuth, async (req, res) => {
    try {
      const goalId = req.params.id;
      const goal = await goalRegistry?.getGoal?.(goalId, services);

      if (!goal) {
        return res.status(404).json({
          ok: false,
          status: 'not_found',
          message: 'Goal not found',
          updatedAt: new Date().toISOString()
        });
      }

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(goal),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'get goal'));
    }
  });

  // Update goal
  app.post('/api/dashboard/long-term-planning/goals/:id/update', requireDashboardAuth, async (req, res) => {
    try {
      const goalId = req.params.id;
      const patch = req.body;
      const updated = await goalRegistry?.updateGoal?.(goalId, patch, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Goal updated successfully',
        data: sanitizeOutput(updated),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'update goal'));
    }
  });

  // Archive goal
  app.post('/api/dashboard/long-term-planning/goals/:id/archive', requireDashboardAuth, async (req, res) => {
    try {
      const goalId = req.params.id;
      const archived = await goalRegistry?.archiveGoal?.(goalId, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Goal archived successfully',
        data: sanitizeOutput(archived),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'archive goal'));
    }
  });

  // List milestones for goal
  app.get('/api/dashboard/long-term-planning/goals/:id/milestones', requireDashboardAuth, async (req, res) => {
    try {
      const goalId = req.params.id;
      const milestones = await milestoneManager?.listMilestones?.(goalId, services) || [];

      res.json({
        ok: true,
        status: 'success',
        data: { milestones: sanitizeOutput(milestones) },
        meta: { goalId, total: milestones.length },
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'list milestones'));
    }
  });

  // Create milestone
  app.post('/api/dashboard/long-term-planning/goals/:id/milestones', requireDashboardAuth, async (req, res) => {
    try {
      const goalId = req.params.id;
      const input = req.body;
      const milestone = await milestoneManager?.createMilestone?.(goalId, input, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Milestone created successfully',
        data: sanitizeOutput(milestone),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'create milestone'));
    }
  });

  // Weekly roadmap
  app.get('/api/dashboard/long-term-planning/roadmap/weekly', requireDashboardAuth, async (req, res) => {
    try {
      const roadmap = await roadmapBuilder?.buildWeeklyRoadmap?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(roadmap),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'weekly roadmap'));
    }
  });

  // Monthly roadmap
  app.get('/api/dashboard/long-term-planning/roadmap/monthly', requireDashboardAuth, async (req, res) => {
    try {
      const roadmap = await roadmapBuilder?.buildMonthlyRoadmap?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(roadmap),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'monthly roadmap'));
    }
  });

  // Quarterly roadmap
  app.get('/api/dashboard/long-term-planning/roadmap/quarterly', requireDashboardAuth, async (req, res) => {
    try {
      const roadmap = await roadmapBuilder?.buildQuarterlyRoadmap?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(roadmap),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'quarterly roadmap'));
    }
  });

  // Recalculate priorities
  app.post('/api/dashboard/long-term-planning/prioritize', requireDashboardAuth, async (req, res) => {
    try {
      const result = await priorityRecalculator?.recalculateGoalPriorities?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        message: 'Priorities recalculated successfully',
        data: sanitizeOutput(result),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'recalculate priorities'));
    }
  });

  // Detect blockers
  app.get('/api/dashboard/long-term-planning/blockers', requireDashboardAuth, async (req, res) => {
    try {
      const blockers = await blockerDetector?.detectProjectBlockers?.(services) || [];

      res.json({
        ok: true,
        status: 'success',
        data: { blockers: sanitizeOutput(blockers) },
        meta: { total: blockers.length },
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'detect blockers'));
    }
  });

  // Progress review
  app.get('/api/dashboard/long-term-planning/progress', requireDashboardAuth, async (req, res) => {
    try {
      const progress = await progressReviewer?.reviewAllGoalProgress?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(progress),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'progress review'));
    }
  });

  // Create workflow proposal
  app.post('/api/dashboard/long-term-planning/workflow-proposal', requireDashboardAuth, async (req, res) => {
    try {
      const { goalId } = req.body;
      const proposal = await planningWorkflowBridge?.proposeWorkflowForGoal?.(goalId, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Workflow proposal created',
        data: sanitizeOutput(proposal),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'create workflow proposal'));
    }
  });

  // Create action proposal
  app.post('/api/dashboard/long-term-planning/action-proposal', requireDashboardAuth, async (req, res) => {
    try {
      const { goalId, actionPlan } = req.body;
      const proposal = await planningProposalBridge?.createGoalActionProposal?.(goalId, actionPlan, services);

      res.json({
        ok: true,
        status: 'success',
        message: 'Action proposal created',
        data: sanitizeOutput(proposal),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'create action proposal'));
    }
  });

  // Full report
  app.get('/api/dashboard/long-term-planning/report', requireDashboardAuth, async (req, res) => {
    try {
      const report = await planningReportGenerator?.buildPlanningReport?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(report),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'planning report'));
    }
  });
}

module.exports = { registerLongTermPlanningRoutes };
