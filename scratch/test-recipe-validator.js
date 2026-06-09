'use strict';

const { recipeValidator } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // validateRecipe with valid recipe
  const valid = recipeValidator.validateRecipe({
    name: 'Test Recipe',
    trigger: { type: 'manual' },
    actions: [{ type: 'send_message' }]
  });
  assert(valid.valid === true, 'valid recipe passes');
  assert(valid.errors.length === 0, 'valid recipe has no errors');

  // missing name
  const noName = recipeValidator.validateRecipe({
    trigger: { type: 'manual' },
    actions: [{ type: 'send_message' }]
  });
  assert(noName.valid === false, 'missing name fails');
  assert(noName.errors.some(e => e.includes('name')), 'missing name error');

  // unknown trigger
  const badTrigger = recipeValidator.validateRecipe({
    name: 'Bad',
    trigger: { type: 'alien_invasion' },
    actions: [{ type: 'send_message' }]
  });
  assert(badTrigger.valid === false, 'unknown trigger fails');
  assert(badTrigger.errors.some(e => e.includes('Unknown trigger')), 'unknown trigger error');

  // missing trigger
  const noTrigger = recipeValidator.validateRecipe({
    name: 'No Trigger',
    actions: [{ type: 'send_message' }]
  });
  assert(noTrigger.valid === false, 'missing trigger fails');

  // no actions
  const noActions = recipeValidator.validateRecipe({
    name: 'No Actions',
    trigger: { type: 'manual' },
    actions: []
  });
  assert(noActions.valid === false, 'no actions fails');
  assert(noActions.errors.some(e => e.includes('action')), 'no actions error');

  // invalid timeout
  const badTimeout = recipeValidator.validateRecipe({
    name: 'Bad Timeout',
    trigger: { type: 'manual' },
    actions: [{ type: 'send_message' }],
    timeout: -1
  });
  assert(badTimeout.valid === false, 'negative timeout fails');
  assert(badTimeout.errors.some(e => e.includes('Timeout')), 'invalid timeout error');

  // unknown action type
  const badAction = recipeValidator.validateRecipe({
    name: 'Bad Action',
    trigger: { type: 'manual' },
    actions: [{ type: 'teleport' }]
  });
  assert(badAction.valid === false, 'unknown action fails');

  // validateTriggerConfig
  const validTrigger = recipeValidator.validateTriggerConfig({ type: 'manual' });
  assert(validTrigger.valid === true, 'valid trigger config passes');

  const noType = recipeValidator.validateTriggerConfig({});
  assert(noType.valid === false, 'trigger without type fails');

  const unknown = recipeValidator.validateTriggerConfig({ type: 'magic' });
  assert(unknown.valid === false, 'unknown trigger type fails');

  const scheduleNoCron = recipeValidator.validateTriggerConfig({ type: 'schedule' });
  assert(scheduleNoCron.valid === false, 'schedule without cron fails');

  const webhookNoPath = recipeValidator.validateTriggerConfig({ type: 'webhook' });
  assert(webhookNoPath.valid === false, 'webhook without path fails');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
