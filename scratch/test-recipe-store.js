'use strict';

const { recipeStore } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  recipeStore.resetStore();

  // createRecipe
  const r1 = recipeStore.createRecipe({ name: 'Test Recipe', trigger: { type: 'manual' }, actions: [{ type: 'send_message' }], tags: ['test'] });
  assert(r1 && r1.name === 'Test Recipe', 'createRecipe returns recipe with name');
  assert(r1.id && r1.id.startsWith('recipe_'), 'createRecipe generates id');
  assert(r1.enabled === true, 'createRecipe enabled defaults true');
  assert(r1.runCount === 0, 'createRecipe runCount is 0');

  // getRecipe
  const fetched = recipeStore.getRecipe(r1.id);
  assert(fetched && fetched.id === r1.id, 'getRecipe returns recipe by id');
  assert(recipeStore.getRecipe('nonexistent') === null, 'getRecipe returns null for missing');

  // updateRecipe
  const updated = recipeStore.updateRecipe(r1.id, { name: 'Updated Recipe' });
  assert(updated && updated.name === 'Updated Recipe', 'updateRecipe changes name');
  assert(updated.name === 'Updated Recipe', 'updateRecipe updates name');
  assert(recipeStore.updateRecipe('nonexistent', {}) === null, 'updateRecipe returns null for missing');

  // removeRecipe
  const r2 = recipeStore.createRecipe({ name: 'To Delete' });
  assert(recipeStore.removeRecipe(r2.id) === true, 'removeRecipe returns true');
  assert(recipeStore.getRecipe(r2.id) === null, 'removeRecipe removes recipe');
  assert(recipeStore.removeRecipe('nonexistent') === false, 'removeRecipe returns false for missing');

  // listRecipes with filters
  recipeStore.createRecipe({ name: 'Disabled', enabled: false, trigger: { type: 'schedule' }, actions: [{ type: 'log_event' }] });
  recipeStore.createRecipe({ name: 'Tagged', trigger: { type: 'webhook' }, actions: [{ type: 'http_request' }], tags: ['special'] });
  const all = recipeStore.listRecipes();
  assert(all.length >= 3, 'listRecipes returns all recipes');
  const enabled = recipeStore.listRecipes({ enabled: true });
  assert(enabled.every(r => r.enabled === true), 'listRecipes filter enabled');
  const byTag = recipeStore.listRecipes({ tag: 'special' });
  assert(byTag.length >= 1 && byTag.every(r => r.tags.includes('special')), 'listRecipes filter tag');
  const byTrigger = recipeStore.listRecipes({ trigger: 'webhook' });
  assert(byTrigger.every(r => r.trigger.type === 'webhook'), 'listRecipes filter trigger');

  // recordExecution / getExecutionLog / getAllExecutionLogs
  recipeStore.recordExecution(r1.id, { status: 'completed' });
  recipeStore.recordExecution(r1.id, { status: 'failed', error: 'timeout' });
  const execLog = recipeStore.getExecutionLog(r1.id);
  assert(execLog.length === 2, 'getExecutionLog returns 2 entries');
  assert(execLog[0].status === 'completed', 'execution log has status');
  assert(execLog.every(e => e.recipeId === r1.id), 'execution log filtered by recipeId');

  const allLogs = recipeStore.getAllExecutionLogs();
  assert(allLogs.length >= 2, 'getAllExecutionLogs returns logs');

  const recipe = recipeStore.getRecipe(r1.id);
  assert(recipe.runCount === 2, 'recordExecution increments runCount');

  // resetStore
  recipeStore.resetStore();
  assert(recipeStore.listRecipes().length === 0, 'resetStore clears recipes');
  assert(recipeStore.getAllExecutionLogs().length === 0, 'resetStore clears executions');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
