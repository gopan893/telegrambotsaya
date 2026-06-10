'use strict';
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const SCRATCH = __dirname;

async function run() {
  const tests = [
    'test-startup-profiler.js',
    'test-import-cost-analyzer.js',
    'test-dashboard-bundle-auditor.js',
    'test-dashboard-lazy-loader-planner.js',
    'test-api-response-profiler.js',
    'test-payload-size-auditor.js',
    'test-cache-efficiency-auditor.js',
    'test-performance-budget-manager.js',
    'test-performance-regression-detector.js',
    'test-performance-scorecard.js',
    'test-performance-dashboard-api.js'
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

  console.log(`\n=== Phase 64 Performance Regression: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`  FAILED: ${f.testFile} — ${f.message}`);
    }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
