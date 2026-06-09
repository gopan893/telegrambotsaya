'use strict';

const { recipeStore, recipeRollbackManager } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  recipeStore.resetStore();

  // Create a recipe with reversible and non-reversible actions
  const r1 = recipeStore.createRecipe({
    name: 'Rollback Test',
    trigger: { type: 'manual' },
    actions: [
      { type: 'create_memory', params: { content: 'test', tags: ['test'] } },
      { type: 'create_goal', params: { title: 'Test Goal' } },
      { type: 'create_insight', params: { category: 'test', content: 'insight' } },
      { type: 'send_message', params: { text: 'hello' } },
      { type: 'log_event', params: { action: 'test' } }
    ]
  });

  // Record some executions so canRollback can find them
  recipeStore.recordExecution(r1.id, { status: 'completed', actionResults: [] });
  recipeStore.recordExecution(r1.id, { status: 'completed', actionResults: [] });

  // canRollback
  const rb0 = recipeRollbackManager.canRollback(r1.id, 0);
  assert(rb0.ok === true, 'canRollback execution 0 ok');
  assert(rb0.execution.status === 'completed', 'canRollback returns execution');

  const rbMissing = recipeRollbackManager.canRollback(r1.id, 99);
  assert(rbMissing.ok === false, 'canRollback bad index fails');
  assert(rbMissing.error === 'Execution not found', 'canRollback error message');

  // getUndoPlan - action that exists
  const plan = recipeRollbackManager.getUndoPlan(r1.id, 'send_message');
  assert(plan.ok === true, 'getUndoPlan ok');
  assert(plan.failedAction === 'send_message', 'getUndoPlan failedAction');
  assert(plan.reversals.length === 3, 'getUndoPlan 3 reversals before failed action');
  assert(plan.fullyReversible === true, 'all completed actions are reversible');

  // Verify reversals for reversible actions
  assert(plan.reversals[0].originalAction === 'create_insight', 'reversal 0 is create_insight');
  assert(plan.reversals[0].reversalType === 'archive_insight', 'create_insight reversal is archive_insight');
  assert(plan.reversals[0].reversible === true, 'create_insight reversible');
  assert(plan.reversals[1].originalAction === 'create_goal', 'reversal 1 is create_goal');
  assert(plan.reversals[1].reversalType === 'archive_goal', 'create_goal reversal is archive_goal');
  assert(plan.reversals[2].originalAction === 'create_memory', 'reversal 2 is create_memory');
  assert(plan.reversals[2].reversalType === 'delete_memory', 'create_memory reversal is delete_memory');

  // Non-reversible action
  assert(plan.reversals[0].reversible === true, 'create_insight is reversible');

  // getUndoPlan with nonexistent action
  const planBad = recipeRollbackManager.getUndoPlan(r1.id, 'nonexistent_action');
  assert(planBad.ok === false, 'getUndoPlan bad action fails');
  assert(planBad.error === 'Action not found in recipe', 'getUndoPlan bad action error');

  // getUndoPlan with nonexistent recipe
  const planMissing = recipeRollbackManager.getUndoPlan('nonexistent', 'send_message');
  assert(planMissing.ok === false, 'getUndoPlan bad recipe fails');

  // Fully reversible recipe
  const r2 = recipeStore.createRecipe({
    name: 'Only Reversible',
    trigger: { type: 'manual' },
    actions: [
      { type: 'create_memory', params: { content: 'a' } },
      { type: 'create_goal', params: { title: 'b' } }
    ]
  });
  const planFull = recipeRollbackManager.getUndoPlan(r2.id, 'create_goal');
  assert(planFull.ok === true, 'fully reversible plan ok');
  assert(planFull.fullyReversible === true, 'fully reversible is true');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
