'use strict';

const { recipeStore, recipeExecutionEngine } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  recipeStore.resetStore();

  // executeRecipe with simple recipe
  const r1 = recipeStore.createRecipe({
    name: 'Simple Test',
    trigger: { type: 'manual' },
    actions: [{ type: 'send_message', params: { channel: 'telegram', text: 'Hello' } }]
  });
  const result1 = await recipeExecutionEngine.executeRecipe(r1.id, {});
  assert(result1.ok === true, 'executeRecipe ok');
  assert(result1.status === 'completed', 'executeRecipe returns completed');
  assert(result1.actionResults.length === 1, 'executeRecipe has 1 action result');
  assert(result1.actionResults[0].status === 'completed', 'action completed');

  // executeRecipe with disabled recipe
  const r2 = recipeStore.createRecipe({
    name: 'Disabled',
    trigger: { type: 'manual' },
    actions: [{ type: 'log_event' }],
    enabled: false
  });
  const result2 = await recipeExecutionEngine.executeRecipe(r2.id, {});
  assert(result2.ok === false, 'disabled recipe returns ok false');
  assert(result2.error === 'Recipe is disabled', 'disabled recipe error message');

  // executeRecipe with conditions met
  const r3 = recipeStore.createRecipe({
    name: 'With Conditions',
    trigger: { type: 'manual' },
    conditions: [{ type: 'equals', field: '$env', value: 'prod' }],
    actions: [{ type: 'send_notification', params: { title: 'Alert' } }]
  });
  const result3 = await recipeExecutionEngine.executeRecipe(r3.id, { env: 'prod' });
  assert(result3.ok === true, 'conditions met -> ok');
  assert(result3.status === 'completed', 'conditions met -> completed');

  // executeRecipe with conditions not met
  const result4 = await recipeExecutionEngine.executeRecipe(r3.id, { env: 'dev' });
  assert(result4.ok === true, 'conditions not met -> ok');
  assert(result4.status === 'skipped', 'conditions not met -> skipped');
  assert(result4.reason === 'Conditions not met', 'conditions not met reason');

  // executeRecipe with bypass flag
  const result5 = await recipeExecutionEngine.executeRecipe(r3.id, { __bypassConditions: true });
  assert(result5.ok === true, 'bypass conditions -> ok');
  assert(result5.status === 'completed', 'bypass conditions -> completed');

  // Missing recipe
  const missing = await recipeExecutionEngine.executeRecipe('nonexistent', {});
  assert(missing.ok === false && missing.error === 'Recipe not found', 'missing recipe returns error');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
