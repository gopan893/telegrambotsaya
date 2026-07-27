'use strict';

function generateV2RollbackPlan(services) {
  const registry = generateRegistryRollbackPlan(services);
  const dashboard = generateDashboardRollbackPlan(services);
  const boundary = generateBoundaryRollbackPlan(services);
  const performance = generatePerformanceRollbackPlan(services);
  const checklist = buildV2RollbackChecklist(services);

  return {
    summary: 'Rollback requires proposal creation and approval. No direct rollback executed.',
    plans: { registry, dashboard, boundary, performance },
    checklist,
    timestamp: new Date().toISOString(),
  };
}

function generateRegistryRollbackPlan(services) {
  return {
    component: 'registry-v2',
    steps: [
      'Create rollback proposal for registry v2 → v1',
      'Submit proposal for review and approval',
      'Upon approval, restore v1 registry data from backup',
      'Verify v1 registry endpoints respond correctly',
      'Update DNS/config to point back to v1 registry',
    ],
    requiresApproval: true,
  };
}

function generateDashboardRollbackPlan(services) {
  return {
    component: 'dashboard',
    steps: [
      'Create rollback proposal for dashboard v2 tabs',
      'Submit proposal for review and approval',
      'Upon approval, revert dashboard to v1 tab configuration',
      'Verify all v1 dashboard tabs load without errors',
      'Clear any v2-specific cached data',
    ],
    requiresApproval: true,
  };
}

function generateBoundaryRollbackPlan(services) {
  return {
    component: 'boundary',
    steps: [
      'Create rollback proposal for boundary service',
      'Submit proposal for review and approval',
      'Upon approval, redeploy previous boundary version',
      'Verify boundary certification passes',
      'Confirm all services reconnect to old boundary',
    ],
    requiresApproval: true,
  };
}

function generatePerformanceRollbackPlan(services) {
  return {
    component: 'performance',
    steps: [
      'Create rollback proposal for performance budget changes',
      'Submit proposal for review and approval',
      'Upon approval, revert performance threshold configuration',
      'Reset performance monitoring to v1 baseline',
      'Verify performance metrics return to expected levels',
    ],
    requiresApproval: true,
  };
}

function buildV2RollbackChecklist(services) {
  return [
    { step: 'Identify what needs rollback', done: false },
    { step: 'Create rollback proposal', done: false },
    { step: 'Get proposal approved', done: false },
    { step: 'Execute rollback per component plan', done: false },
    { step: 'Verify system stability post-rollback', done: false },
    { step: 'Document rollback outcome', done: false },
  ];
}

module.exports = {
  generateV2RollbackPlan,
  generateRegistryRollbackPlan,
  generateDashboardRollbackPlan,
  generateBoundaryRollbackPlan,
  generatePerformanceRollbackPlan,
  buildV2RollbackChecklist,
};
