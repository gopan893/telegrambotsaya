'use strict';

const { recipeUtils } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // generateRecipeId
  const id1 = recipeUtils.generateRecipeId('My Test Recipe');
  assert(id1.startsWith('my_test_recipe_'), 'generateRecipeId converts name to slug');

  const id2 = recipeUtils.generateRecipeId('Hello & World!!');
  assert(id2.startsWith('hello_world_'), 'generateRecipeId strips special chars');

  const id3 = recipeUtils.generateRecipeId('');
  assert(id3.startsWith('_'), 'generateRecipeId handles empty name');

  // formatRecipeSummary
  const summary1 = recipeUtils.formatRecipeSummary({
    enabled: true, name: 'Test', trigger: { type: 'schedule' }, actions: [{}, {}], conditions: [{}, {}]
  });
  assert(summary1.includes('[ON]'), 'formatRecipeSummary shows ON for enabled');
  assert(summary1.includes('Test'), 'formatRecipeSummary includes name');
  assert(summary1.includes('schedule'), 'formatRecipeSummary includes trigger type');
  assert(summary1.includes('2 actions'), 'formatRecipeSummary includes action count');
  assert(summary1.includes('2 conditions'), 'formatRecipeSummary includes condition count');

  const summary2 = recipeUtils.formatRecipeSummary({
    enabled: false, name: 'Off', trigger: { type: 'manual' }, actions: [], conditions: []
  });
  assert(summary2.includes('[OFF]'), 'formatRecipeSummary shows OFF for disabled');

  // estimateRecipeComplexity
  const simple = recipeUtils.estimateRecipeComplexity({ actions: [{}, {}], conditions: [] });
  assert(simple.score === 4, 'estimateRecipeComplexity simple score 4');
  assert(simple.level === 'simple', 'estimateRecipeComplexity simple level');

  const moderate = recipeUtils.estimateRecipeComplexity({ actions: [{}, {}, {}], conditions: [{}, {}] });
  assert(moderate.score === 12, 'estimateRecipeComplexity moderate score 12');
  assert(moderate.level === 'moderate', 'estimateRecipeComplexity moderate level');

  const complex = recipeUtils.estimateRecipeComplexity({ actions: [{}], conditions: [{}], parallel: true, maxRetries: 1, timeout: 5000 });
  assert(complex.score >= 10, 'estimateRecipeComplexity complex score >= 10');
  assert(complex.level === 'moderate' || complex.level === 'complex', 'estimateRecipeComplexity complex level');

  const complex2 = recipeUtils.estimateRecipeComplexity({ actions: [{}, {}, {}, {}], conditions: [{}, {}], parallel: true, maxRetries: 3, timeout: 5000 });
  assert(complex2.level === 'complex', 'estimateRecipeComplexity complex2 level');

  // validateCronExpression
  assert(recipeUtils.validateCronExpression('0 8 * * *') === true, 'validateCronExpression valid 5-part');
  assert(recipeUtils.validateCronExpression('0/5 * * * *') === true, 'validateCronExpression step');
  assert(recipeUtils.validateCronExpression('0 9 * * 1-5') === true, 'validateCronExpression range');
  assert(recipeUtils.validateCronExpression('0,30 * * * *') === true, 'validateCronExpression list');
  assert(recipeUtils.validateCronExpression('0 8 * *') === false, 'validateCronExpression 4 parts fails');
  assert(recipeUtils.validateCronExpression('') === false, 'validateCronExpression empty fails');
  assert(recipeUtils.validateCronExpression(null) === false, 'validateCronExpression null fails');
  assert(recipeUtils.validateCronExpression('invalid') === false, 'validateCronExpression invalid string fails');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
