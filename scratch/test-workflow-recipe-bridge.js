'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-recipe-bridge'));

  check(typeof mod.convertRecipeToWorkflowData === 'function', 'convertRecipeToWorkflowData is a function');
  check(typeof mod.convertRecipeToWorkflow === 'function', 'convertRecipeToWorkflow is a function');

  const noRecipe = mod.convertRecipeToWorkflowData(null);
  check(noRecipe === null, 'Invalid recipe returns null');

  const recipe = mod.convertRecipeToWorkflowData({ name: 'Test', trigger: { type: 'manual' }, actions: [{ type: 'send_message' }] });
  check(recipe !== null, 'Convert recipe succeeds');
  check(recipe.steps && recipe.steps.length > 0, 'Converted workflow has steps');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-recipe-bridge.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Recipe Bridge: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
