'use strict';
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const SCRATCH = __dirname;

async function run() {
  const tests = [
    'test-v2-release-candidate-manager.js',
    'test-v2-readiness-gate.js',
    'test-v2-regression-suite-runner.js',
    'test-v2-upgrade-guide-generator.js',
    'test-v2-changelog-generator.js',
    'test-v2-compatibility-checker.js',
    'test-v2-rollback-plan-generator.js',
    'test-v2-release-notes-generator.js',
    'test-v2-release-proposal-bridge.js',
    'test-v2-release-dashboard-api.js'
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

  console.log(`\n=== Phase 65 V2 Release Candidate Regression: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`  FAILED: ${f.testFile} — ${f.message}`);
    }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
