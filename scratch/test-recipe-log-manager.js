'use strict';

const { recipeLogManager } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  recipeLogManager.clearLogs();

  // logExecution
  const e1 = recipeLogManager.logExecution('recipe_a', 'started', { trigger: 'manual' });
  assert(e1 && e1.id && e1.id.startsWith('rlog_'), 'logExecution returns entry with id');
  assert(e1.recipeId === 'recipe_a', 'logExecution stores recipeId');
  assert(e1.event === 'started', 'logExecution stores event');

  const e2 = recipeLogManager.logExecution('recipe_a', 'completed', { status: 'ok' });
  assert(e2 !== null, 'logExecution second entry');

  const e3 = recipeLogManager.logExecution('recipe_b', 'failed', { error: 'timeout' });
  assert(e3 !== null, 'logExecution recipe_b entry');

  // getRecipeLogs
  const logsA = recipeLogManager.getRecipeLogs('recipe_a');
  assert(logsA.length === 2, 'getRecipeLogs returns 2 for recipe_a');
  assert(logsA.every(l => l.recipeId === 'recipe_a'), 'getRecipeLogs filtered by recipeId');
  assert(logsA[0].event === 'completed' || logsA[0].event === 'started', 'logs have event field');

  const logsB = recipeLogManager.getRecipeLogs('recipe_b');
  assert(logsB.length === 1, 'getRecipeLogs returns 1 for recipe_b');

  const logsMissing = recipeLogManager.getRecipeLogs('nonexistent');
  assert(logsMissing.length === 0, 'getRecipeLogs missing returns empty');

  // getAllLogs
  const all = recipeLogManager.getAllLogs();
  assert(all.length === 3, 'getAllLogs returns 3 entries');

  // getLogStats
  const stats = recipeLogManager.getLogStats();
  assert(stats.recipe_a === 2, 'getLogStats recipe_a count 2');
  assert(stats.recipe_b === 1, 'getLogStats recipe_b count 1');
  assert(stats._total === 3, 'getLogStats _total 3');

  // clearLogs
  recipeLogManager.clearLogs();
  assert(recipeLogManager.getAllLogs().length === 0, 'clearLogs removes all logs');
  assert(Object.keys(recipeLogManager.getLogStats()).length === 0 || recipeLogManager.getLogStats()._total === undefined, 'clearLogs resets stats');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
