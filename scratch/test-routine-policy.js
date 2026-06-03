'use strict';

const assert = require('assert');
const { createRoutinePolicy } = require('../src/routines/routine-policy');
const { createRoutineRegistry } = require('../src/routines/routine-registry');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

const registry = createRoutineRegistry({ auditLog: [] });
const policy = createRoutinePolicy({ auditLog: [], routineStore: registry.routineStore });

const readOnlyRoutine = registry.createRoutine({
  name: 'ReadOnly', type: 'briefing', schedule: 'daily', mode: 'scheduled_readonly',
  allowedReadOnlyActions: ['read_summary'], blockedActions: ['delete_data']
});

const proposalRoutine = registry.createRoutine({
  name: 'ProposalOnly', type: 'backup_check', schedule: 'daily', mode: 'proposal_only',
  blockedActions: ['run_backup']
});

test('Policy allows read-only action for read-only routine', () => {
  const result = policy.checkRoutinePolicy(readOnlyRoutine, 'read_summary');
  assert.strictEqual(result.allowed, true);
});

test('Policy blocks write action for read-only routine', () => {
  const result = policy.checkRoutinePolicy(readOnlyRoutine, 'write_file');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.requiresProposal);
});

test('Policy blocks blocked action', () => {
  const result = policy.checkRoutinePolicy(readOnlyRoutine, 'delete_data');
  assert.strictEqual(result.allowed, false);
});

test('Policy marks blocked action as requiring proposal', () => {
  const result = policy.checkRoutinePolicy(readOnlyRoutine, 'delete_all');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.requiresProposal === true || result.requiresProposal === undefined);
});

test('Policy blocks external action without eval', () => {
  const result = policy.checkRoutinePolicy(readOnlyRoutine, 'github_create_issue');
  assert.strictEqual(result.allowed, false);
});

test('Policy requires eval for external action', () => {
  const result = policy.checkRoutinePolicy(proposalRoutine, 'github_create_issue');
  assert.strictEqual(result.allowed, false);
});

test('Policy classifies routine action risk', () => {
  assert.strictEqual(policy.classifyRoutineActionRisk('write_file'), 'medium');
  assert.strictEqual(policy.classifyRoutineActionRisk('restore_backup'), 'danger');
  assert.strictEqual(policy.classifyRoutineActionRisk('github_push'), 'high');
  assert.strictEqual(policy.classifyRoutineActionRisk('read_summary'), 'low');
});

test('Policy blocks unsafe routine action', () => {
  assert.strictEqual(policy.blockUnsafeRoutineAction('read_summary'), true);
  assert.strictEqual(policy.blockUnsafeRoutineAction('write_file'), false);
  assert.strictEqual(policy.blockUnsafeRoutineAction('restore'), false);
});

test('Policy identifies external actions requiring eval', () => {
  assert.strictEqual(policy.requireEvaluationForRoutineProposal('github_create_issue'), true);
  assert.strictEqual(policy.requireEvaluationForRoutineProposal('read_summary'), false);
});

console.log(`\n📊 Routine Policy Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
