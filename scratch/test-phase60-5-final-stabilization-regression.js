'use strict';

const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const tests = [
    'test-v1-final-lock-manager.js',
    'test-v1-final-readiness-gate.js',
    'test-control-panel-certifier.js',
    'test-dashboard-api-certifier.js',
    'test-pwa-mobile-certifier.js',
    'test-telegram-command-certifier.js',
    'test-safety-boundary-certifier.js'
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const out = execSync(`node ${path.join(ROOT, 'scratch', test)}`, { cwd: ROOT, timeout: 10000 });
      console.log(out.toString().trim());
      passed++;
    } catch (err) {
      console.error(`FAIL: ${test} — ${err.stderr?.toString()?.trim() || err.message}`);
      failed++;
    }
  }

  console.log(`\n=== PHASE 60.5 REGRESSION ===`);
  console.log(`Tests: ${tests.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) process.exit(1);
}

run();
