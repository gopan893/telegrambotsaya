'use strict';

const utils = require('./selfhealing-utils');

function createRepairPlanGenerator(store, services) {
  async function createRepairPlanFromGuardFailure(run, ctx) {
    const guard = await store.getGuard(run.guardId);
    const steps = [
      'Audit ' + (guard ? guard.suggestedRepair || 'the affected module' : 'the affected module'),
      'Run relevant tests',
      'Verify fix with node --check',
      'Run dashboard router tests if applicable'
    ];
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Repair: ' + (guard ? guard.name : run.guardId),
      problemSummary: run.summary || 'Guard failure detected',
      affectedAreas: guard ? [guard.category, guard.checkType] : ['unknown'],
      suspectedRootCause: guard ? guard.failureMessage : 'Unknown guard failure',
      repairSteps: steps,
      filesLikelyAffected: guard ? suggestFiles(guard) : [],
      testsToRun: suggestTests(guard),
      riskLevel: guard && guard.severity === 'critical' ? 'high' : 'medium',
      requiresApproval: guard && guard.severity === 'critical',
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  async function createRepairPlanFromError(error, ctx) {
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Repair: ' + (error.name || 'Unknown Error'),
      problemSummary: error.message || 'Unknown error',
      affectedAreas: ['unknown'],
      suspectedRootCause: error.stack ? error.stack.split('\n').slice(0, 3).join(' ') : 'No stack trace',
      repairSteps: ['Investigate error', 'Fix the issue', 'Run tests'],
      filesLikelyAffected: [],
      testsToRun: ['node --check telebot.js'],
      riskLevel: 'medium',
      requiresApproval: false,
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  async function createDashboardRepairPlan(failure, ctx) {
    const steps = [
      'Check state.js DASHBOARD_TABS registry for missing entries',
      'Check ui.js for missing renderer functions',
      'Check app.js renderTabContent for correct routing',
      'Verify styles.css for dark form selectors',
      'Run all dashboard router tests'
    ];
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Dashboard Route Repair',
      problemSummary: failure.summary || 'Dashboard routing regression detected',
      affectedAreas: ['dashboard', 'ui'],
      suspectedRootCause: failure.details || 'Tab registry or renderer mismatch',
      repairSteps: steps,
      filesLikelyAffected: ['public/dashboard/state.js', 'public/dashboard/ui.js', 'public/dashboard/app.js', 'public/dashboard/index.html'],
      testsToRun: ['node scratch/test-dashboard-router-registry.js', 'node scratch/test-dashboard-all-menu-routes.js', 'node scratch/test-dashboard-dark-form-ui.js'],
      riskLevel: 'high',
      requiresApproval: true,
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  async function createNaturalChatRepairPlan(failure, ctx) {
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Natural Chat Routing Repair',
      problemSummary: failure.summary || 'Natural chat routing regression',
      affectedAreas: ['natural_chat', 'agents'],
      suspectedRootCause: 'Routing classifier misconfiguration',
      repairSteps: ['Audit natural chat router', 'Fix routing rules', 'Verify personal/school advice routing'],
      filesLikelyAffected: ['src/natural-language/natural-chat-router.js', 'src/agents/classifier.js'],
      testsToRun: ['node scratch/test-natural-chat-guard.js', 'node scratch/test-natural-chat-stable-release.js'],
      riskLevel: 'high',
      requiresApproval: true,
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  async function createExecutorRepairPlan(failure, ctx) {
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Executor Safety Repair',
      problemSummary: failure.summary || 'Executor safety regression',
      affectedAreas: ['executor', 'approval'],
      suspectedRootCause: 'Approval flow bypass detected',
      repairSteps: ['Audit executor approval flow', 'Fix self-approve check', 'Verify proposal no auto-run'],
      filesLikelyAffected: ['src/executor/index.js', 'src/executor/approval.js'],
      testsToRun: ['node scratch/test-executor-safety-guard.js', 'node scratch/test-executor-boundary-stable-release.js'],
      riskLevel: 'critical',
      requiresApproval: true,
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  async function createIntegrationRepairPlan(failure, ctx) {
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Integration Gate Repair',
      problemSummary: failure.summary || 'Integration gate regression',
      affectedAreas: ['integration', 'evaluation'],
      suspectedRootCause: 'Evaluation v2 gate bypassed',
      repairSteps: ['Audit integration gate check', 'Fix Evaluation v2 integration', 'Verify dry-run safety'],
      filesLikelyAffected: ['src/integrations/gate.js', 'src/integrations/executor.js'],
      testsToRun: ['node scratch/test-integration-gate-guard.js', 'node scratch/test-integration-gate-stable-release.js'],
      riskLevel: 'critical',
      requiresApproval: true,
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  async function createCodingRepairPlan(failure, ctx) {
    return store.saveRepairPlan({
      id: utils.generateId('rp'),
      workspaceId: ctx.workspaceId || '',
      userId: ctx.userId || '',
      title: 'Coding Workspace Guard Repair',
      problemSummary: failure.summary || 'Coding workspace regression',
      affectedAreas: ['coding_workspace'],
      suspectedRootCause: 'Personal advice routing to coding workspace',
      repairSteps: ['Audit coding classifier', 'Fix personal/school advice filter', 'Verify no repo mutation'],
      filesLikelyAffected: ['src/coding/classifier.js', 'src/coding/workspace.js'],
      testsToRun: ['node scratch/test-coding-workspace-stable-release.js', 'node scratch/test-repair-plan-generator.js'],
      riskLevel: 'high',
      requiresApproval: true,
      codexPrompt: '',
      executorProposalId: '',
      status: 'draft',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    });
  }

  function suggestFiles(guard) {
    if (!guard) return [];
    switch (guard.category) {
      case 'dashboard': return ['public/dashboard/state.js', 'public/dashboard/ui.js', 'public/dashboard/app.js', 'public/dashboard/styles.css'];
      case 'natural_chat': return ['src/natural-language/natural-chat-router.js', 'src/agents/classifier.js'];
      case 'executor': return ['src/executor/index.js', 'src/executor/approval.js'];
      case 'integration': return ['src/integrations/gate.js', 'src/integrations/executor.js'];
      case 'coding_workspace': return ['src/coding/classifier.js', 'src/coding/workspace.js'];
      case 'boot': return ['src/bot/app.js', 'package.json'];
      case 'storage': return ['src/storage/index.js'];
      default: return [];
    }
  }

  function suggestTests(guard) {
    if (!guard) return ['node --check telebot.js'];
    switch (guard.category) {
      case 'dashboard': return ['node scratch/test-dashboard-router-registry.js', 'node scratch/test-dashboard-all-menu-routes.js'];
      case 'natural_chat': return ['node scratch/test-natural-chat-guard.js'];
      case 'executor': return ['node scratch/test-executor-safety-guard.js'];
      case 'integration': return ['node scratch/test-integration-gate-guard.js'];
      case 'coding_workspace': return ['node scratch/test-repair-plan-generator.js'];
      case 'boot': return ['node --check telebot.js'];
      default: return ['node --check telebot.js'];
    }
  }

  return {
    createRepairPlanFromGuardFailure,
    createRepairPlanFromError,
    createDashboardRepairPlan,
    createNaturalChatRepairPlan,
    createExecutorRepairPlan,
    createIntegrationRepairPlan,
    createCodingRepairPlan
  };
}

module.exports = { createRepairPlanGenerator };
