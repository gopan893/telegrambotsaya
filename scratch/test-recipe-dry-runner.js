'use strict';

const { recipeStore, recipeDryRunner } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  recipeStore.resetStore();

  // Create a recipe with conditions and actions
  const r1 = recipeStore.createRecipe({
    name: 'Dry Run Test',
    trigger: { type: 'manual' },
    conditions: [{ type: 'equals', field: '$env', value: 'prod' }],
    actions: [
      { type: 'send_message', params: { channel: 'telegram', text: 'Hello' } },
      { type: 'log_event', params: { action: 'test', detail: 'dry run' } }
    ]
  });

  // dryRunRecipe with conditions met
  const result1 = await recipeDryRunner.dryRunRecipe(r1.id, { env: 'prod' });
  assert(result1.ok === true, 'dryRunRecipe ok');
  assert(result1.conditionsMet === true, 'conditions met');
  assert(result1.actionCount === 2, 'actionCount is 2');
  assert(result1.simulatedActions.length === 2, 'simulatedActions length 2');
  assert(result1.simulatedActions[0].wouldExecute === true, 'actions wouldExecute when conditions met');
  assert(result1.simulatedActions[0].type === 'send_message', 'first action type');

  // dryRunRecipe with conditions not met
  const result2 = await recipeDryRunner.dryRunRecipe(r1.id, { env: 'dev' });
  assert(result2.ok === true, 'dryRunRecipe not met ok');
  assert(result2.conditionsMet === false, 'conditions not met');
  assert(result2.simulatedActions[0].wouldExecute === false, 'actions wouldExecute false when not met');

  // dryRunRecipe nonexistent
  const missing = await recipeDryRunner.dryRunRecipe('nonexistent', {});
  assert(missing.ok === false && missing.error === 'Recipe not found', 'dryRunRecipe missing returns error');

  // Recipe without conditions
  const r2 = recipeStore.createRecipe({
    name: 'No Conditions',
    trigger: { type: 'manual' },
    actions: [{ type: 'send_notification', params: { title: 'Test' } }]
  });
  const result3 = await recipeDryRunner.dryRunRecipe(r2.id, {});
  assert(result3.conditionsMet === true, 'no conditions means met');
  assert(result3.actionCount === 1, '1 action without conditions');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
