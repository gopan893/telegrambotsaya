'use strict';

const health = require('../src/model-router/model-health-checker');
const store = require('../src/model-router/model-router-store');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { env: {} };

  // Check all providers (with no env set, local/cloud will be unhealthy, fallback stub should be ok)
  const results = await health.checkAllModelProviders(svc);
  assert(Array.isArray(results), 'checkAllModelProviders returns array');

  // Build report
  const report = health.buildModelHealthReport(results, svc);
  assert(report.total === results.length, 'buildModelHealthReport total matches');
  assert(report.summary, 'buildModelHealthReport has summary');

  // Provider health
  if (results.length > 0) {
    const first = results[0];
    assert(typeof first.healthy === 'boolean', 'provider health has healthy boolean');
  }

  // Local health
  const localHealth = await health.checkLocalModelHealth(svc);
  assert(localHealth.id === 'local', 'checkLocalModelHealth returns local');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
