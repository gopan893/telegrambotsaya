'use strict';
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const SCRATCH = __dirname;

async function run() {
  const tests = [
    'test-unified-registry-contract.js',
    'test-dashboard-tab-registry-v2.js',
    'test-dashboard-api-registry-v2.js',
    'test-telegram-command-registry-v2.js',
    'test-capability-registry-v2.js',
    'test-alias-registry-v2.js',
    'test-registry-v2-normalizer.js',
    'test-registry-v2-validator.js',
    'test-registry-v2-compatibility-bridge.js',
    'test-registry-v2-conflict-detector.js',
    'test-registry-v2-dashboard-api.js'
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const testFile of tests) {
    const fullPath = path.join(SCRATCH, testFile);
    try {
      const output = execSync(`node "${fullPath}"`, { timeout: 30000, encoding: 'utf8' });
      const lines = output.trim().split('\n').filter(l => l.startsWith('PASS:'));
      for (const line of lines) {
        console.log(line);
        passed++;
      }
    } catch (err) {
      const msg = (err.stderr || err.stdout || err.message || '').trim();
      const failLine = msg.split('\n').find(l => l.startsWith('FAIL:')) || `${testFile}: ${msg}`;
      console.log(failLine);
      failed++;
      failures.push({ testFile, message: msg });
    }
  }

  console.log(`\n=== Phase 62 Registry Normalization Regression: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`  FAILED: ${f.testFile} — ${f.message}`);
    }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
