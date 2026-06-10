'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

async function run() {
  const stabilizationFiles = [
    'src/stabilization/stabilization-store.js',
    'src/stabilization/v1-final-lock-manager.js',
    'src/stabilization/v1-final-readiness-gate.js',
    'src/stabilization/control-panel-certifier.js',
    'src/stabilization/dashboard-api-certifier.js',
    'src/stabilization/pwa-mobile-certifier.js',
    'src/stabilization/telegram-command-certifier.js',
    'src/stabilization/safety-boundary-certifier.js',
    'src/stabilization/stabilization-report-generator.js',
    'src/stabilization/stabilization-utils.js'
  ];

  for (const file of stabilizationFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `File exists: ${file}`);
    const mod = require(path.join(ROOT, file));
    assert.ok(typeof mod === 'object' || typeof mod === 'function', `${file} exports module`);
  }
  console.log('PASS: v1-final-lock-manager — all stabilization files exist');

  const lockManager = require(path.join(ROOT, 'src/stabilization/v1-final-lock-manager'));
  const lock = await lockManager.startV1FinalLock({ workspaceId: 'test' });
  assert.ok(lock, 'startV1FinalLock returns lock');
  assert.strictEqual(lock.status, 'checking', 'Initial status is checking');

  const status = await lockManager.getV1FinalLockStatus({ workspaceId: 'test' });
  assert.ok(status, 'getV1FinalLockStatus returns status');

  const allowed = await lockManager.blockFeatureWorkDuringV1Lock({ type: 'p0-bug-fix' });
  assert.strictEqual(allowed.allowed, true, 'P0 bug fix allowed');

  const blocked = await lockManager.blockFeatureWorkDuringV1Lock({ type: 'new-feature-module', description: 'new connector' });
  assert.strictEqual(blocked.allowed, false, 'New feature blocked');

  const report = await lockManager.buildV1FinalLockReport({ workspaceId: 'test' });
  assert.ok(report, 'buildV1FinalLockReport returns report');
  assert.ok(typeof report.score === 'number', 'Report has numeric score');

  console.log('PASS: v1-final-lock-manager — all behaviors verified\n');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
