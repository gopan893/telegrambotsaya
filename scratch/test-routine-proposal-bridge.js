'use strict';

const assert = require('assert');
const { createRoutineProposalBridge } = require('../src/routines/routine-proposal-bridge');
const { createRoutineRegistry } = require('../src/routines/routine-registry');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

const auditLog = [];
const registry = createRoutineRegistry({ auditLog });
const bridge = createRoutineProposalBridge({ auditLog, registry, executorSystem: null, evaluationSystem: null });

const store = registry.routineStore;
const run = store.createRun({ routineId: 'test_routine', workspaceId: 'default', userId: 'test', mode: 'proposal_only' });

test('Proposal bridge creates action plan', () => {
  const rec = { action: 'create_backup_proposal', reason: 'Backup needed', requiresEvaluation: false };
  const plan = bridge.createRoutineActionPlan(run, rec, {});
  assert.ok(plan);
  assert.strictEqual(plan.action, 'create_backup_proposal');
});

test('Proposal bridge handles missing executor system', () => {
  const plan = { action: 'test', reason: 'test', requiresEvaluation: false };
  const result = bridge.createRoutineExecutorProposal(run, plan, {});
  assert.ok(result.error);
  assert.ok(result.error.includes('Executor'));
});

test('Proposal bridge requires evaluation for external actions', () => {
  const plan = { action: 'github_create_issue', reason: 'Bug report', requiresEvaluation: true };
  const result = bridge.createRoutineExecutorProposal(run, plan, {});
  assert.ok(result.error);
  assert.ok(result.error.includes('Evaluation'));
});

test('Proposal bridge links run to proposal', () => {
  const result = bridge.linkRoutineRunToProposal(run.id, 'prop_test_1', {});
  assert.strictEqual(result, true);
});

test('Proposal bridge retrieves linked proposals', () => {
  const proposals = bridge.getRoutineLinkedProposals(run.id);
  assert.ok(Array.isArray(proposals));
});

console.log(`\n📊 Routine Proposal Bridge Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
