'use strict';

const { recipeActionRegistry } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // getAction returns known actions
  assert(recipeActionRegistry.getAction('send_message'), 'getAction send_message exists');
  assert(recipeActionRegistry.getAction('send_notification'), 'getAction send_notification exists');
  assert(recipeActionRegistry.getAction('create_memory'), 'getAction create_memory exists');
  assert(recipeActionRegistry.getAction('create_goal'), 'getAction create_goal exists');
  assert(recipeActionRegistry.getAction('update_goal'), 'getAction update_goal exists');
  assert(recipeActionRegistry.getAction('create_insight'), 'getAction create_insight exists');
  assert(recipeActionRegistry.getAction('log_event'), 'getAction log_event exists');
  assert(recipeActionRegistry.getAction('run_health_check'), 'getAction run_health_check exists');
  assert(recipeActionRegistry.getAction('trigger_workflow'), 'getAction trigger_workflow exists');
  assert(recipeActionRegistry.getAction('run_research'), 'getAction run_research exists');
  assert(recipeActionRegistry.getAction('export_data'), 'getAction export_data exists');
  assert(recipeActionRegistry.getAction('call_connector'), 'getAction call_connector exists');
  assert(recipeActionRegistry.getAction('http_request'), 'getAction http_request exists');
  assert(recipeActionRegistry.getAction('set_variable'), 'getAction set_variable exists');
  assert(recipeActionRegistry.getAction('condition_branch'), 'getAction condition_branch exists');
  assert(recipeActionRegistry.getAction('delay'), 'getAction delay exists');
  assert(recipeActionRegistry.getAction('unknown') === null, 'getAction unknown returns null');

  // listActions
  const all = recipeActionRegistry.listActions();
  assert(all.length === 16, 'listActions returns 16 actions');
  assert(all[0].id && all[0].name && all[0].category, 'listActions items have id/name/category');

  // listActions with category filter
  const comms = recipeActionRegistry.listActions('communication');
  assert(comms.length >= 2, 'listActions filter communication category');
  assert(comms.every(a => a.category === 'communication'), 'listActions filtered by category');

  const logic = recipeActionRegistry.listActions('logic');
  assert(logic.length === 2, 'listActions filter logic category');

  // listActionCategories
  const categories = recipeActionRegistry.listActionCategories();
  assert(categories.includes('communication'), 'listActionCategories includes communication');
  assert(categories.includes('storage'), 'listActionCategories includes storage');
  assert(categories.includes('monitoring'), 'listActionCategories includes monitoring');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
