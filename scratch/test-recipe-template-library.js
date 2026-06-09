'use strict';

const { recipeTemplateLibrary, recipeStore } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // getTemplate returns expected templates
  const daily = recipeTemplateLibrary.getTemplate('daily_summary');
  assert(daily !== null, 'getTemplate daily_summary exists');
  assert(daily.name === 'Daily Summary', 'daily_summary name');
  assert(daily.trigger.type === 'schedule', 'daily_summary trigger schedule');
  assert(daily.actions.length === 3, 'daily_summary 3 actions');

  const weekly = recipeTemplateLibrary.getTemplate('weekly_review');
  assert(weekly !== null, 'getTemplate weekly_review exists');
  assert(weekly.name === 'Weekly Review', 'weekly_review name');

  const errorAlert = recipeTemplateLibrary.getTemplate('error_alert');
  assert(errorAlert !== null, 'getTemplate error_alert exists');
  assert(errorAlert.conditions.length === 1, 'error_alert has 1 condition');

  const goal = recipeTemplateLibrary.getTemplate('goal_milestone');
  assert(goal !== null, 'getTemplate goal_milestone exists');

  const health = recipeTemplateLibrary.getTemplate('weekly_health_check');
  assert(health !== null, 'getTemplate weekly_health_check exists');

  const webhook = recipeTemplateLibrary.getTemplate('webhook_data_ingest');
  assert(webhook !== null, 'getTemplate webhook_data_ingest exists');

  assert(recipeTemplateLibrary.getTemplate('nonexistent') === null, 'getTemplate nonexistent returns null');

  // listTemplates
  const all = recipeTemplateLibrary.listTemplates();
  assert(all.length === 6, 'listTemplates returns 6 templates');

  // listTemplates with tag filter
  const monitoring = recipeTemplateLibrary.listTemplates('monitoring');
  assert(monitoring.length >= 2, 'listTemplates filter monitoring tag');
  assert(monitoring.every(t => t.tags.includes('monitoring')), 'listTemplates filtered by tag');

  const productivity = recipeTemplateLibrary.listTemplates('productivity');
  assert(productivity.length >= 2, 'listTemplates filter productivity tag');

  // createRecipeFromTemplate
  recipeStore.resetStore();
  const created = recipeTemplateLibrary.createRecipeFromTemplate('daily_summary', { name: 'My Daily' });
  assert(created !== null, 'createRecipeFromTemplate returns recipe');
  assert(created.name === 'My Daily', 'createRecipeFromTemplate uses override name');
  assert(created.actions.length === 3, 'createRecipeFromTemplate copies actions');
  assert(recipeStore.getRecipe(created.id) !== null, 'createRecipeFromTemplate stores recipe');

  const bad = recipeTemplateLibrary.createRecipeFromTemplate('nonexistent');
  assert(bad === null, 'createRecipeFromTemplate bad template returns null');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
