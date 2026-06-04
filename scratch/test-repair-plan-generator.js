'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

var repairGen;
try {
  repairGen = require('../src/selfhealing/repair-plan-generator');
  assert(true, 'repair-plan-generator module loads');
  assert(typeof repairGen.createRepairPlanGenerator === 'function', 'createRepairPlanGenerator is function');
} catch (e) {
  assert(false, 'repair-plan-generator module loads: ' + e.message);
}

var mockStore = {
  getGuard: function(id) { return { id: id, name: 'Test Guard', category: 'dashboard', severity: 'critical', failureMessage: 'Test failure', suggestedRepair: 'Fix it' }; },
  saveRepairPlan: function(plan) { return plan; }
};

var generator = repairGen.createRepairPlanGenerator(mockStore, {});

// Test createRepairPlanFromGuardFailure
generator.createRepairPlanFromGuardFailure({ guardId: 'gd_test', summary: 'Test failure' }, { workspaceId: '', userId: '' }).then(function(plan) {
  assert(!!plan.id, 'repair plan has id');
  assert(plan.title.length > 0, 'repair plan has title');
  assert(plan.problemSummary === 'Test failure', 'repair plan has problem summary');
  assert(Array.isArray(plan.repairSteps), 'repair plan has steps');
  assert(Array.isArray(plan.filesLikelyAffected), 'repair plan has affected files');
  assert(Array.isArray(plan.testsToRun), 'repair plan has tests');
  assert(plan.riskLevel === 'high' || plan.riskLevel === 'medium', 'repair plan has risk level');
  assert(typeof plan.requiresApproval === 'boolean', 'repair plan has requiresApproval');
  assert(plan.status === 'draft', 'repair plan starts as draft');
});

// Test createDashboardRepairPlan
generator.createDashboardRepairPlan({ summary: 'Dashboard tab missing' }, { workspaceId: '', userId: '' }).then(function(plan) {
  assert(plan.title.indexOf('Dashboard') >= 0, 'dashboard repair plan has relevant title');
  assert(plan.filesLikelyAffected.indexOf('public/dashboard/state.js') >= 0, 'dashboard repair plan mentions state.js');
  assert(plan.requiresApproval === true, 'dashboard repair plan requires approval');
});

// Test createExecutorRepairPlan
generator.createExecutorRepairPlan({ summary: 'Self-approve bypass' }, { workspaceId: '', userId: '' }).then(function(plan) {
  assert(plan.title.indexOf('Executor') >= 0, 'executor repair plan has relevant title');
  assert(plan.riskLevel === 'critical', 'executor repair plan risk level is critical');
});

// Test createIntegrationRepairPlan
generator.createIntegrationRepairPlan({ summary: 'Eval gate bypass' }, { workspaceId: '', userId: '' }).then(function(plan) {
  assert(plan.title.indexOf('Integration') >= 0, 'integration repair plan has relevant title');
});

console.log('\n=== Repair Plan Generator ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
