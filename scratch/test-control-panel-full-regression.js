'use strict';

console.log('=== Control Panel Full Regression ===\n');

const tests = [
  'test-control-panel-menu-registry.js',
  'test-control-panel-renderers.js',
  'test-control-panel-no-overview-fallback.js',
  'test-control-panel-mobile-pwa-safety.js',
  'test-control-panel-secret-redaction.js',
  'test-control-panel-content-validation.js',
  'test-control-panel-content-no-cross-tab-leak.js',
  'test-control-panel-content-empty-state.js',
  'test-control-panel-content-api-contract.js',
  'test-control-panel-broken-menu-matrix.js'
];

const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname);

let totalPass = 0;
let totalFail = 0;
let totalTests = 0;

tests.forEach(testFile => {
  const fullPath = path.join(ROOT, testFile);
  try {
    const output = execSync(`node ${fullPath}`, { encoding: 'utf8', timeout: 30000 });
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    const p = passMatch ? parseInt(passMatch[1]) : 0;
    const f = failMatch ? parseInt(failMatch[1]) : 0;
    totalPass += p;
    totalFail += f;
    totalTests++;
    console.log(`PASS: ${testFile} — ${p} passed, ${f} failed`);
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message;
    const failCount = (msg.match(/FAIL:/g) || []).length;
    totalFail += Math.max(failCount, 1);
    console.error(`FAIL: ${testFile} — ${msg.substring(0, 200)}`);
  }
});

console.log(`\n=== FULL REGRESSION SUMMARY ===`);
console.log(`Tests run: ${totalTests}`);
console.log(`Total assertions passed: ${totalPass}`);
console.log(`Total assertions failed: ${totalFail}`);
if (totalFail > 0) process.exit(1);
