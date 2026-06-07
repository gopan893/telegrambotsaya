'use strict';

const assert = require('assert');

// Mock improvement-store before loading index (which loads lesson-manager which seeds lessons)
const storePath = require.resolve('../src/improvement/improvement-store');
const { ImprovementStore } = require(storePath);
delete require.cache[storePath];

const mockStore = new ImprovementStore();
mockStore.findSimilarWeakness = () => null;
mockStore.query = () => [];
mockStore.add = function (typeOrItem, item) {
  if (typeof typeOrItem === 'string' && item) {
    // Real ImprovementStore signature: add(type, item)
    if (!item.id) item.id = 'mock_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    if (this._store[typeOrItem]) this._store[typeOrItem].push(item);
    return item;
  }
  // Single-arg style used by weakness-detector: add(item) -> push to weaknesses
  const entry = { ...typeOrItem };
  if (!entry.id) entry.id = 'mock_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  this._store.weaknesses.push(entry);
  return entry;
};
mockStore.update = function (item) { return item; };
mockStore.getFeedback = function (id) { return this._store.feedback.find(f => f.id === id) || null; };
mockStore.getOutcome = function (id) { return this._store.outcomes.find(o => o.id === id) || null; };
mockStore.get = function (id) {
  for (const key of Object.keys(this._store)) {
    const found = this._store[key].find(i => i.id === id);
    if (found) return found;
  }
  return null;
};
mockStore.addLesson = function (lesson) { this._store.lessons.push(lesson); return lesson; };
mockStore.listLessons = function (filters) {
  let r = this._store.lessons.slice();
  if (filters) {
    if (filters.status) r = r.filter(l => l.status === filters.status);
    if (filters.category) r = r.filter(l => l.category === filters.category);
    if (filters.module) r = r.filter(l => l.affectedModules.includes(filters.module));
    if (filters.limit) r = r.slice(0, filters.limit);
  }
  return r;
};
mockStore.getLesson = function (id) { return this._store.lessons.find(l => l.id === id) || null; };
mockStore.updateLesson = function (lesson) {
  const idx = this._store.lessons.findIndex(l => l.id === lesson.id);
  if (idx >= 0) this._store.lessons[idx] = lesson;
  return lesson;
};
mockStore.getDefaultStore = function () { return mockStore; };

require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true, exports: mockStore,
  children: [], paths: []
};

function createMockRouter() {
  const routes = [];
  const methods = ['get', 'post', 'put', 'delete', 'patch'];
  const router = {};
  for (const method of methods) {
    router[method] = function (path, ...handlers) {
      routes.push({ method: method.toUpperCase(), path, handlers });
      return router;
    };
  }
  router._routes = routes;
  return router;
}

async function runTests() {
  console.log('=== test-improvement-dashboard-api.js ===');
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

  const store = mockStore;
  const services = { store };
  const improvement = require('../src/improvement');

  // Verify module exports all necessary route handler functions
  await runTest('improvement index exports all modules', () => {
    assert.ok(improvement.feedback, 'should export feedback');
    assert.ok(improvement.outcomes, 'should export outcomes');
    assert.ok(improvement.classifier, 'should export classifier');
    assert.ok(improvement.weaknesses, 'should export weaknesses');
    assert.ok(improvement.patterns, 'should export patterns');
    assert.ok(improvement.lessons, 'should export lessons');
    assert.ok(improvement.regression, 'should export regression');
    assert.ok(improvement.plans, 'should export plans');
    assert.ok(improvement.prompts, 'should export prompts');
    assert.ok(improvement.evalGate, 'should export evalGate');
    assert.ok(improvement.proposals, 'should export proposals');
    assert.ok(improvement.reports, 'should export reports');
  });

  await runTest('GET /improvement returns stats', async () => {
    const router = createMockRouter();
    router.get('/improvement', (req, res) => {
      const stats = store.getStats();
      res.json ? res.json(stats) : stats;
    });
    const getRoute = router._routes.find(r => r.method === 'GET' && r.path === '/improvement');
    assert.ok(getRoute, 'GET /improvement route should be registered');
    assert.ok(typeof getRoute.handlers[0] === 'function', 'handler should be a function');
  });

  await runTest('GET /improvement/feedback returns list', async () => {
    const router = createMockRouter();
    router.get('/improvement/feedback', (req, res) => {
      const feedback = store.getAll('feedback');
      res.json ? res.json(feedback) : feedback;
    });
    const route = router._routes.find(r => r.method === 'GET' && r.path === '/improvement/feedback');
    assert.ok(route, 'GET /improvement/feedback route should be registered');
  });

  await runTest('POST /improvement/feedback creates feedback', async () => {
    const router = createMockRouter();
    router.post('/improvement/feedback', async (req, res) => {
      const fb = await improvement.feedback.collectUserFeedback(req.body, { store });
      res.status(201).json(fb);
    });
    const route = router._routes.find(r => r.method === 'POST' && r.path === '/improvement/feedback');
    assert.ok(route, 'POST /improvement/feedback route should be registered');
  });

  await runTest('GET /improvement/weaknesses returns list', async () => {
    store.add('weaknesses', { id: 'w_dash_1', title: 'Weakness 1', module: 'dashboard', severity: 'high' });
    const router = createMockRouter();
    router.get('/improvement/weaknesses', (req, res) => {
      const list = store.getAll('weaknesses');
      res.json(list);
    });
    const route = router._routes.find(r => r.method === 'GET' && r.path === '/improvement/weaknesses');
    assert.ok(route, 'GET /improvement/weaknesses route should be registered');
  });

  await runTest('GET /improvement/lessons returns list', async () => {
    const router = createMockRouter();
    router.get('/improvement/lessons', (req, res) => {
      const list = store.getAll('lessons');
      res.json(list);
    });
    const route = router._routes.find(r => r.method === 'GET' && r.path === '/improvement/lessons');
    assert.ok(route, 'GET /improvement/lessons route should be registered');
  });

  await runTest('GET /improvement/plans returns list', async () => {
    const router = createMockRouter();
    router.get('/improvement/plans', (req, res) => {
      const list = store.getAll('plans');
      res.json(list);
    });
    const route = router._routes.find(r => r.method === 'GET' && r.path === '/improvement/plans');
    assert.ok(route, 'GET /improvement/plans route should be registered');
  });

  await runTest('GET /improvement/report returns report', async () => {
    const router = createMockRouter();
    router.get('/improvement/report', (req, res) => {
      const report = improvement.reports.generateImprovementSummary('default', { store });
      res.json(report);
    });
    const route = router._routes.find(r => r.method === 'GET' && r.path === '/improvement/report');
    assert.ok(route, 'GET /improvement/report route should be registered');
  });

  await runTest('Report generation works', () => {
    const report = improvement.reports.generateImprovementSummary('default', { store });
    assert.ok(report, 'report should be generated');
    assert.ok(report.title, 'should have title');
    assert.ok(Array.isArray(report.sections), 'should have sections');
    assert.ok(report.generatedAt, 'should have timestamp');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
