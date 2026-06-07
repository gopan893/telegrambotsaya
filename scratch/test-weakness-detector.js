'use strict';

const assert = require('assert');

// ---- Mock improvement-store before loading modules that depend on it ----
const storePath = require.resolve('../src/improvement/improvement-store');
const { ImprovementStore } = require(storePath);
delete require.cache[storePath];

const mockStore = new ImprovementStore();
mockStore.findSimilarWeakness = () => null;
mockStore.query = function (filters) {
  if (!filters) return this._store.weaknesses.slice();
  return this._store.weaknesses.filter(w => {
    for (const key of Object.keys(filters)) {
      if (w[key] !== filters[key]) return false;
    }
    return true;
  });
};
mockStore.add = function (item) {
  if (!item.id) item.id = 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  this._store.weaknesses.push(item);
  return item;
};
mockStore.update = function (item) {
  const idx = this._store.weaknesses.findIndex(w => w.id === item.id);
  if (idx >= 0) this._store.weaknesses[idx] = item;
  return item;
};

require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true, exports: mockStore,
  children: [], paths: []
};
// ---- end mock ----

const detector = require('../src/improvement/weakness-detector');

async function runTests() {
  console.log('=== test-weakness-detector.js ===');
  const results = [];

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      results.push({ name, passed: true });
    } catch (err) {
      console.log(`  FAIL: ${name} - ${err.message}`);
      results.push({ name, passed: false, error: err.message });
    }
  }

  await runTest('detectWeaknessFromFeedback creates weakness from feedback', async () => {
    mockStore._store.weaknesses = [];
    const fb = { id: 'fb1', text: 'Dashboard route tab missing in sidebar', workspaceId: 'w1' };
    const weaknesses = await detector.detectWeaknessFromFeedback(fb);
    assert.ok(Array.isArray(weaknesses), 'should return array');
    assert.ok(weaknesses.length >= 1, 'should detect dashboard routing issue');
    assert.strictEqual(weaknesses[0].module, 'dashboard');
    assert.strictEqual(weaknesses[0].severity, 'high');
  });

  await runTest('detectWeaknessFromFeedback returns empty for unrelated text', async () => {
    mockStore._store.weaknesses = [];
    const fb = { id: 'fb2', text: 'Saya suka fitur ini' };
    const weaknesses = await detector.detectWeaknessFromFeedback(fb);
    assert.ok(Array.isArray(weaknesses));
    assert.strictEqual(weaknesses.length, 0);
  });

  await runTest('detectWeaknessFromOutcome creates weakness from outcome', async () => {
    mockStore._store.weaknesses = [];
    const outcome = { id: 'o1', success: false, summary: 'Build failed', workspaceId: 'w2' };
    const weaknesses = await detector.detectWeaknessFromOutcome(outcome);
    assert.ok(Array.isArray(weaknesses));
    assert.ok(weaknesses.length >= 1, 'should detect failed outcome');
    assert.strictEqual(weaknesses[0].severity, 'high');
  });

  await runTest('detectWeaknessFromOutcome detects cost spike', async () => {
    mockStore._store.weaknesses = [];
    const outcome = { id: 'o2', metrics: { cost: 500, threshold: 100 } };
    const weaknesses = await detector.detectWeaknessFromOutcome(outcome);
    const costW = weaknesses.find(w => w.module === 'cost');
    assert.ok(costW, 'should detect cost spike');
    assert.strictEqual(costW.severity, 'medium');
  });

  await runTest('detectWeaknessFromOutcome detects timeout', async () => {
    mockStore._store.weaknesses = [];
    const outcome = { id: 'o3', metrics: { duration: 60000, timeout: 30000 } };
    const weaknesses = await detector.detectWeaknessFromOutcome(outcome);
    const timeoutW = weaknesses.find(w => w.module === 'executor');
    assert.ok(timeoutW, 'should detect timeout');
    assert.strictEqual(timeoutW.severity, 'medium');
  });

  await runTest('detectRepeatedDashboardFailure checks for repeated failures', async () => {
    mockStore._store.weaknesses = [];
    mockStore.add({ module: 'dashboard', status: 'open', title: 'd1' });
    mockStore.add({ module: 'dashboard', status: 'open', title: 'd2' });
    mockStore.add({ module: 'dashboard', status: 'open', title: 'd3' });
    const result = await detector.detectRepeatedDashboardFailure();
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1, 'should detect repeated dashboard failures');
    assert.strictEqual(result[0].module, 'dashboard');
    assert.strictEqual(result[0].severity, 'high');
  });

  await runTest('detectRepeatedRoutingFailure checks for routing issues', async () => {
    mockStore._store.weaknesses = [];
    mockStore.add({ module: 'routing', status: 'open', title: 'r1' });
    mockStore.add({ module: 'routing', status: 'open', title: 'r2' });
    const result = await detector.detectRepeatedRoutingFailure();
    assert.ok(result.length >= 1);
    assert.strictEqual(result[0].module, 'routing');
  });

  await runTest('detectRepeatedCostSpike checks for cost issues', async () => {
    mockStore._store.weaknesses = [];
    mockStore.add({ module: 'cost', status: 'open', title: 'c1' });
    mockStore.add({ module: 'cost', status: 'open', title: 'c2' });
    const result = await detector.detectRepeatedCostSpike();
    assert.ok(result.length >= 1);
    assert.strictEqual(result[0].module, 'cost');
  });

  await runTest('Weakness model has correct fields', async () => {
    mockStore._store.weaknesses = [];
    const fb = { id: 'fb_model', text: 'Deploy fail error in production', workspaceId: 'w1' };
    const weaks = await detector.detectWeaknessFromFeedback(fb);
    assert.ok(weaks.length > 0, 'should detect weakness');
    const weakness = weaks[0];
    assert.ok(weakness.id, 'should have id');
    assert.ok(weakness.module, 'should have module');
    assert.ok(weakness.severity, 'should have severity');
    assert.ok(weakness.evidence, 'should have evidence');
    assert.ok(weakness.frequency, 'should have frequency');
    assert.ok(weakness.status, 'should have status');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
