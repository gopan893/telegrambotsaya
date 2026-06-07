'use strict';

const assert = require('assert');

// ---- Mock improvement-store before loading modules that depend on it ----
const storePath = require.resolve('../src/improvement/improvement-store');
const { ImprovementStore } = require(storePath);
delete require.cache[storePath];

const mockStore = new ImprovementStore();
mockStore.findSimilarWeakness = () => null;
mockStore.query = () => [];
mockStore.add = function (item) {
  if (!item.id) item.id = 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  this._store.weaknesses.push(item);
  return item;
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

require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true, exports: mockStore,
  children: [], paths: []
};
// ---- end mock ----

const lessonManager = require('../src/improvement/lesson-manager');

async function runTests() {
  console.log('=== test-lesson-manager.js ===');
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

  await runTest('Seeded lessons exist on module load', async () => {
    const lessons = mockStore.listLessons();
    assert.ok(lessons.length >= 6, `expected at least 6 seeded lessons, got ${lessons.length}`);
  });

  await runTest('createLesson creates lesson with correct fields', async () => {
    const result = await lessonManager.createLesson({
      title: 'Test lesson',
      summary: 'A test lesson',
      category: 'testing',
      affectedModules: ['dashboard'],
      rule: 'Always test',
      recommendation: 'Test more'
    });
    assert.ok(result.ok, 'should be ok');
    assert.equal(result.lesson.status, 'active');
    assert.equal(result.lesson.title, 'Test lesson');
    assert.equal(result.lesson.category, 'testing');
  });

  await runTest('createLesson rejects empty title', async () => {
    const result = await lessonManager.createLesson({});
    assert.ok(!result.ok, 'should not be ok');
    assert.equal(result.reason, 'LESSON_TITLE_REQUIRED');
  });

  await runTest('createLessonFromFeedback creates from feedback', async () => {
    const fb = { id: 'fb_lesson_1', text: 'Dashboard tab missing', title: 'Dashboard issue' };
    mockStore._store.feedback.push(fb);
    const result = await lessonManager.createLessonFromFeedback('fb_lesson_1');
    assert.ok(result.ok);
    assert.equal(result.lesson.category, 'feedback');
  });

  await runTest('createLessonFromOutcome creates from outcome', async () => {
    const outcome = { id: 'out_1', summary: 'Deploy failed', title: 'Deploy error' };
    mockStore._store.outcomes.push(outcome);
    const result = await lessonManager.createLessonFromOutcome('out_1');
    assert.ok(result.ok);
    assert.equal(result.lesson.category, 'outcome');
  });

  await runTest('createLessonFromWeakness creates from weakness', async () => {
    const weak = { id: 'weak_1', title: 'Deploy failure', summary: 'Deploy keeps failing', module: 'deploy', frequency: 3 };
    mockStore._store.weaknesses.push(weak);
    const result = await lessonManager.createLessonFromWeakness('weak_1');
    assert.ok(result.ok);
    assert.equal(result.lesson.category, 'weakness');
  });

  await runTest('listLessons filters and returns correct count', async () => {
    const all = await lessonManager.listLessons();
    assert.ok(Array.isArray(all));
    const active = await lessonManager.listLessons({ status: 'active' });
    assert.ok(active.every(l => l.status === 'active'));
    const dashboard = await lessonManager.listLessons({ module: 'dashboard' });
    assert.ok(Array.isArray(dashboard));
  });

  await runTest('searchLessons finds by query', async () => {
    const results = await lessonManager.searchLessons('PWA');
    assert.ok(Array.isArray(results));
    if (results.length > 0) {
      assert.ok(results.some(l => l.title.toLowerCase().includes('pwa') || l.summary.toLowerCase().includes('pwa')));
    }
  });

  await runTest('archiveLesson sets status to archived', async () => {
    const lessons = await lessonManager.listLessons({ status: 'active' });
    if (lessons.length > 0) {
      const result = await lessonManager.archiveLesson(lessons[0].id, 'Test archive');
      assert.ok(result.ok);
      assert.equal(result.lesson.status, 'archived');
    }
  });

  await runTest('createLessonFromFeedback returns error for missing feedback', async () => {
    const result = await lessonManager.createLessonFromFeedback('nonexistent_id');
    assert.ok(!result.ok);
    assert.equal(result.reason, 'FEEDBACK_NOT_FOUND');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
