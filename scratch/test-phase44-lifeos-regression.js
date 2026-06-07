'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const evalCases = require('../src/agents/eval/evaluation-golden-cases');
const gates = require('../src/agents/eval/evaluation-quality-gates');
const dryRunner = require('../src/agents/eval/evaluation-dry-runner');

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'index.html'), 'utf8');
const stateJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'state.js'), 'utf8');
const swJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'service-worker.js'), 'utf8');
const lifeosJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'lifeos.js'), 'utf8');

assert.ok(indexHtml.includes('data-tab="lifeos"'), 'Life OS menu item must exist');
assert.ok(indexHtml.includes('/dashboard/lifeos.js?v=20260607-phase44-lifeos'), 'Life OS frontend asset must be loaded');
assert.ok(stateJs.includes('lifeos:'), 'Life OS tab must be registered in dashboard state');
assert.ok(stateJs.includes("renderer: 'renderLifeOS'"), 'Life OS renderer must be registered');
assert.ok(lifeosJs.includes('renderLifeOS'), 'Life OS renderer function must exist');
assert.ok(swJs.includes('/dashboard/lifeos.js'), 'service worker should cache Life OS static JS');
assert.ok(swJs.includes("url.pathname.startsWith('/api/dashboard')"), 'service worker must exclude dashboard API');
const staticAssetsBlock = (swJs.match(/const STATIC_ASSETS = \[[\s\S]*?\];/) || [''])[0];
assert.ok(!staticAssetsBlock.includes('/api/dashboard'), 'service worker static assets must not include API paths');

const lifeCases = evalCases.listGoldenCases({ category: 'lifeos' });
assert.ok(lifeCases.length >= 8, 'Life OS golden cases should be registered');
for (const key of ['lifePrivacyScore', 'secretRedactionScore', 'externalActionSafetyScore', 'personalContextRelevanceScore']) {
  assert.ok(Object.prototype.hasOwnProperty.call(gates.DEFAULT_QUALITY_GATES, key), `${key} gate should exist`);
}

(async () => {
  const calendarCase = evalCases.getGoldenCase('lifeos_calendar_proposal');
  const result = await dryRunner.runDryEvaluation(calendarCase, {});
  assert.equal(result.didExecute, false);
  assert.equal(result.approvalRequired, true);
  assert.equal(result.actionType, 'integration.connector.run');
  assert.ok(!/meeting sudah dibuat|email sudah dikirim/i.test(result.outputText));

  const secretCase = evalCases.getGoldenCase('lifeos_secret_memory_blocked');
  const secret = await dryRunner.runDryEvaluation(secretCase, {});
  assert.equal(secret.didExecute, false);
  assert.ok(!/TELEGRAM_TOKEN=xxx/.test(secret.outputText));

  console.log('test-phase44-lifeos-regression: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
