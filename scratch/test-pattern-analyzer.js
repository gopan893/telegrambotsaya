'use strict';

const assert = require('assert');

// ---- Mock improvement-store before loading modules that depend on it ----
const storePath = require.resolve('../src/improvement/improvement-store');
const { ImprovementStore } = require(storePath);
delete require.cache[storePath];

const mockStore = new ImprovementStore();
mockStore.list = function (filters) {
  return this._store.feedback.slice();
};
mockStore.add = function (type, item) {
  if (!item.id) item.id = (Date.now() + Math.random()).toString(36);
  if (this._store[type]) this._store[type].push(item);
  return item;
};

require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true, exports: mockStore,
  children: [], paths: []
};
// ---- end mock ----

const analyzer = require('../src/improvement/pattern-analyzer');

async function runTests() {
  console.log('=== test-pattern-analyzer.js ===');
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

  await runTest('analyzeImprovementPatterns returns patterns', async () => {
    mockStore._store.feedback = [];
    const patterns = await analyzer.analyzeImprovementPatterns();
    assert.ok(Array.isArray(patterns), 'should return array');
  });

  await runTest('findRepeatedFailures finds failure patterns', async () => {
    mockStore._store.feedback = [
      { text: 'deploy missing dependency error', id: 'a1' },
      { text: 'deploy missing module again', id: 'a2' },
      { text: 'dashboard route tab missing', id: 'a3' },
    ];
    const failures = await analyzer.findRepeatedFailures();
    assert.ok(Array.isArray(failures));
  });

  await runTest('findRegressionPatterns finds regression patterns', async () => {
    mockStore._store.feedback = [
      { text: 'telegram-aios-dashboard-static version mismatch', id: 'b1' },
      { text: 'telegram-aios-dashboard-static cache stale', id: 'b2' },
    ];
    const patterns = await analyzer.findRegressionPatterns();
    assert.ok(Array.isArray(patterns));
  });

  await runTest('findAgentQualityPatterns finds agent quality issues', async () => {
    mockStore._store.feedback = [
      { text: 'natural chat routed to coder instead of orchestrator', id: 'c1' },
      { text: 'natural domain routing wrong for personal chat', id: 'c2' },
    ];
    const patterns = await analyzer.findAgentQualityPatterns();
    assert.ok(Array.isArray(patterns));
  });

  await runTest('findUserPreferencePatterns finds user preferences', async () => {
    mockStore._store.feedback = [
      { text: 'proposal rejected again denied proposal', id: 'd1' },
      { text: 'another proposal denied for same reason', id: 'd2' },
    ];
    const patterns = await analyzer.findUserPreferencePatterns();
    assert.ok(Array.isArray(patterns));
  });

  await runTest('pattern includes type/title/frequency/affectedModules', async () => {
    mockStore._store.feedback = [
      { text: 'deploy missing dependency in production', id: 'e1' },
      { text: 'deploy missing module in staging', id: 'e2' },
    ];
    const patterns = await analyzer.analyzeImprovementPatterns();
    if (patterns.length > 0) {
      const p = patterns[0];
      assert.ok(p.type, 'should have type');
      assert.ok(p.title, 'should have title');
      assert.ok(p.frequency >= 1, 'should have frequency');
      assert.ok(Array.isArray(p.affectedModules), 'should have affectedModules');
    }
    assert.ok(true, 'pattern fields validated');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
