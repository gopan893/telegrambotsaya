'use strict';

const { recipeTriggerRegistry } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // getTrigger returns known triggers
  assert(recipeTriggerRegistry.getTrigger('manual'), 'getTrigger manual exists');
  assert(recipeTriggerRegistry.getTrigger('schedule'), 'getTrigger schedule exists');
  assert(recipeTriggerRegistry.getTrigger('webhook'), 'getTrigger webhook exists');
  assert(recipeTriggerRegistry.getTrigger('file_change'), 'getTrigger file_change exists');
  assert(recipeTriggerRegistry.getTrigger('memory_added'), 'getTrigger memory_added exists');
  assert(recipeTriggerRegistry.getTrigger('goal_completed'), 'getTrigger goal_completed exists');
  assert(recipeTriggerRegistry.getTrigger('insight_generated'), 'getTrigger insight_generated exists');
  assert(recipeTriggerRegistry.getTrigger('error_detected'), 'getTrigger error_detected exists');
  assert(recipeTriggerRegistry.getTrigger('health_degraded'), 'getTrigger health_degraded exists');
  assert(recipeTriggerRegistry.getTrigger('external_event'), 'getTrigger external_event exists');
  assert(recipeTriggerRegistry.getTrigger('unknown') === null, 'getTrigger unknown returns null');

  // listTriggers
  const all = recipeTriggerRegistry.listTriggers();
  assert(all.length === 10, 'listTriggers returns 10 triggers');
  assert(all[0].id && all[0].name && all[0].category, 'listTriggers items have id/name/category');

  // listTriggers with category filter
  const system = recipeTriggerRegistry.listTriggers('system');
  assert(system.length >= 3, 'listTriggers filter system category');
  assert(system.every(t => t.category === 'system'), 'listTriggers filtered by category');

  const time = recipeTriggerRegistry.listTriggers('time');
  assert(time.length === 1 && time[0].id === 'schedule', 'listTriggers filter time');

  // listTriggerCategories
  const categories = recipeTriggerRegistry.listTriggerCategories();
  assert(categories.includes('manual'), 'listTriggerCategories includes manual');
  assert(categories.includes('time'), 'listTriggerCategories includes time');
  assert(categories.includes('network'), 'listTriggerCategories includes network');
  assert(categories.includes('system'), 'listTriggerCategories includes system');
  assert(categories.includes('monitoring'), 'listTriggerCategories includes monitoring');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
