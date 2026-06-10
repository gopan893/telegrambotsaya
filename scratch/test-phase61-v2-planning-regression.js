'use strict';
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const SCRATCH = __dirname;

async function run() {
  const tests = [
    'test-v2-planning-gate.js',
    'test-v2-scope-manager.js',
    'test-v2-architecture-principles.js',
    'test-v2-migration-planner.js',
    'test-v2-risk-register.js',
    'test-v2-acceptance-criteria.js',
    'test-v2-planning-dashboard-api.js'
  ];

  let pass = 0, fail = 0;
  const results = [];

  for (const file of tests) {
    const filePath = path.join(SCRATCH, file);
    try {
      execSync(`node "${filePath}"`, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
      pass++;
      results.push(`PASS: ${file}`);
    } catch (err) {
      fail++;
      const msg = (err.stderr || '').toString().trim() || err.message;
      results.push(`FAIL: ${file} — ${msg}`);
    }
  }

  console.log(results.join('\n'));
  console.log(`\nResult: ${pass} PASS, ${fail} FAIL${fail ? ' — SOME TESTS FAILED' : ' — ALL PASSED'}`);
  process.exit(fail ? 1 : 0);
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
