'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
  if (!item.id) item.id = 'mock_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  this._store.weaknesses.push(item);
  return item;
};
mockStore.update = function (item) {
  const idx = this._store.weaknesses.findIndex(w => w.id === item.id);
  if (idx >= 0) this._store.weaknesses[idx] = item;
  return item;
};
mockStore.list = function () { return this._store.feedback.slice(); };
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
// ---- Mock improvement-utils to add SECRET_PATTERNS export ----
const utilsPath = require.resolve('../src/improvement/improvement-utils');
const realUtils = require(utilsPath);
delete require.cache[utilsPath];
require.cache[utilsPath] = {
  id: utilsPath, filename: utilsPath, loaded: true,
  exports: {
    ...realUtils,
    SECRET_PATTERNS: [
      /token[=:]\s*\S+/gi, /secret[=:]\s*\S+/gi, /password[=:]\s*\S+/gi,
      /api_key[=:]\s*\S+/gi, /Authorization[=:]\s*\S+/gi, /Bearer\s+\S+/gi,
      /DATABASE_URL[=:]\s*\S+/gi, /REDIS_URL[=:]\s*\S+/gi,
      /TELEGRAM_TOKEN[=:]\s*\S+/gi, /GITHUB_TOKEN[=:]\s*\S+/gi,
      /\bsk-\w+/gi, /\bghp_\w+/gi,
    ],
  },
  children: [], paths: []
};
// ---- end mock ----

async function runTests() {
  console.log('=== test-phase46-improvement-regression.js ===');
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

  const feedback = require('../src/improvement/feedback-collector');
  const outcomes = require('../src/improvement/outcome-collector');
  const classifier = require('../src/improvement/quality-signal-classifier');
  const lessons = require('../src/improvement/lesson-manager');
  const weaknesses = require('../src/improvement/weakness-detector');
  const patterns = require('../src/improvement/pattern-analyzer');
  const regression = require('../src/improvement/regression-case-generator');
  const plans = require('../src/improvement/improvement-plan-generator');
  const prompts = require('../src/improvement/next-agent-improvement-prompt');
  const gate = require('../src/improvement/improvement-evaluation-gate');
  const bridge = require('../src/improvement/improvement-proposal-bridge');
  const reports = require('../src/improvement/improvement-report-generator');

  const services = { store: mockStore };
  const reportGenerator = reports;

  // Use a fresh sandbox store for tests where we need isolated state
  const sandboxStore = new ImprovementStore();
  const sandboxServices = { store: sandboxStore };

  // 1. Feedback collector works end-to-end
  await runTest('Feedback collector works end-to-end', async () => {
    const fb = await feedback.collectUserFeedback({ text: 'Dashboard route tab missing', userId: 'u1', workspaceId: 'w1' }, sandboxServices);
    assert.ok(fb, 'feedback created');
    assert.ok(fb.id, 'has id');
    assert.equal(fb.source, 'telegram');
    assert.equal(fb.category, 'dashboard_bug');
    assert.equal(fb.sentiment, 'neutral');
  });

  // 2. Outcome collector works
  await runTest('Outcome collector works', async () => {
    const oc = await outcomes.collectWorkflowOutcome({ summary: 'Build passed', source: 'github_action', workspaceId: 'w1' }, sandboxServices);
    assert.ok(oc, 'outcome created');
    assert.equal(oc.outcomeType, 'github_action');
  });

  // 3. Quality signal classification works
  await runTest('Quality signal classification works', () => {
    const signal = classifier.classifyQualitySignal('deploy error on production');
    assert.equal(signal.severity, 'high');
    assert.equal(signal.category, 'deploy_failure');
    assert.ok(signal.confidence > 0);
  });

  // 4. Lesson creation and management works
  await runTest('Lesson creation and management works', async () => {
    const lesson = await lessons.createLesson({
      title: 'Regression test lesson',
      summary: 'Testing lesson creation',
      category: 'testing',
      affectedModules: ['all'],
      rule: 'Always test',
      recommendation: 'Run tests'
    });
    assert.ok(lesson.ok);
    assert.equal(lesson.lesson.title, 'Regression test lesson');

    const listed = await lessons.listLessons();
    assert.ok(Array.isArray(listed));
  });

  // 5. Weakness detection works
  await runTest('Weakness detection works', async () => {
    mockStore._store.weaknesses = [];
    const fb = { id: 'reg_fb_1', text: 'Deploy fail error production', workspaceId: 'w1' };
    const weaks = await weaknesses.detectWeaknessFromFeedback(fb);
    assert.ok(Array.isArray(weaks));
    const deployWeak = weaks.find(w => w.module === 'deploy');
    assert.ok(deployWeak, 'should detect deploy weakness');
    assert.equal(deployWeak.severity, 'high');
  });

  // 6. Pattern analysis works
  await runTest('Pattern analysis works', async () => {
    mockStore._store.feedback = [
      { text: 'deploy missing dependency in ci/cd pipeline error', id: 'pa1' },
      { text: 'deploy missing module again in staging', id: 'pa2' },
    ];
    const pats = await patterns.analyzeImprovementPatterns();
    assert.ok(Array.isArray(pats));
  });

  // 7. Regression case generation works
  await runTest('Regression case generation works', () => {
    sandboxStore.add('weaknesses', { id: 'reg_w1', title: 'Dashboard tab missing', targetModule: 'dashboard', description: 'Tabs not showing', severity: 'high' });
    const rc = regression.generateRegressionCaseFromWeakness('reg_w1', { store: sandboxStore });
    assert.ok(rc, 'regression case created');
    assert.equal(rc.targetModule, 'dashboard');
    assert.ok(rc.testFileSuggestion, 'has test file suggestion');
  });

  // 8. Improvement plan generation works
  await runTest('Improvement plan generation works', () => {
    sandboxStore.add('weaknesses', { id: 'reg_plan_w1', title: 'Cost spike', targetModule: 'cost', severity: 'medium', workspaceId: 'w1' });
    const plan = plans.createImprovementPlanFromWeakness('reg_plan_w1', { store: sandboxStore });
    assert.ok(plan, 'plan created');
    assert.ok(plan.proposedSteps.length > 0, 'has steps');
    assert.ok(plan.recommendedAgent, 'has recommended agent');
  });

  // 9. Next-agent prompt generation works
  await runTest('Next-agent prompt generation works', () => {
    sandboxStore.add('plans', {
      id: 'reg_plan_p1', title: 'Fix cost spike', summary: 'Cost optimization',
      targetModules: ['cost'], proposedSteps: ['Audit usage'], riskLevel: 'medium',
      sourceWeaknessIds: ['reg_plan_w1'], sourceLessonIds: []
    });
    const prompt = prompts.generateCodexImprovementPrompt('reg_plan_p1', { store: sandboxStore });
    assert.ok(prompt, 'prompt generated');
    assert.equal(prompt.agent, 'codex');
    assert.ok(prompt.goal, 'has goal');
    assert.ok(prompt.safetyRules.length > 0, 'has safety rules');
  });

  // 10. Evaluation gate blocks unsafe actions
  await runTest('Evaluation gate blocks unsafe actions', () => {
    const safePlan = { id: 'safe', title: 'Review code', description: 'Just review', actions: [], riskLevel: 'low' };
    const safeResult = gate.runImprovementEvaluationGate(safePlan);
    assert.ok(safeResult.passed, 'safe plan passes');

    const unsafePlan = {
      id: 'unsafe', title: 'Deploy and push', description: 'git push to deploy to production',
      actions: [{ type: 'deploy', targetType: 'render', description: 'Deploy to production', riskLevel: 'high' }],
      riskLevel: 'high'
    };
    const unsafeResult = gate.runImprovementEvaluationGate(unsafePlan);
    assert.ok(!unsafeResult.passed, 'unsafe plan should be blocked');
    assert.ok(unsafeResult.failures.length > 0, 'should have failures');
  });

  // 11. Proposal bridge creates proposals without executing
  await runTest('Proposal bridge creates proposals without executing', () => {
    const actionPlan = {
      id: 'reg_ap', title: 'Fix dashboard',
      description: 'Fix routing',
      riskLevel: 'low', requiresApproval: true,
      actions: [{ id: 'reg_a1', type: 'review', targetType: 'dashboard', targetId: 'routes', description: 'Review routing', riskLevel: 'low', requiresApproval: true }]
    };
    const proposal = bridge.createImprovementExecutorProposal(actionPlan, sandboxServices);
    assert.ok(proposal, 'proposal created');
    assert.equal(proposal.status, 'pending_approval', 'should NOT be executed');
    assert.ok(proposal.proposedActions.length > 0, 'has actions');
  });

  // 12. Dashboard API routes are registered (via index exports)
  await runTest('Dashboard API routes are available via index exports', () => {
    const idx = require('../src/improvement');
    assert.ok(idx.feedback.collectUserFeedback, 'feedback routes available');
    assert.ok(idx.outcomes.collectWorkflowOutcome, 'outcome routes available');
    assert.ok(idx.classifier.classifyQualitySignal, 'classifier routes available');
    assert.ok(idx.weaknesses.detectWeaknessFromFeedback, 'weakness routes available');
    assert.ok(idx.lessons.createLesson, 'lesson routes available');
    assert.ok(idx.plans.createImprovementPlan, 'plan routes available');
    assert.ok(idx.reports.generateImprovementSummary, 'report routes available');
  });

  // 13. No secrets leaked (scan source files for secret patterns)
  await runTest('No secrets leaked in source files', () => {
    const srcDir = path.resolve(__dirname, '../src/improvement');
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      assert.ok(!content.includes('TELEGRAM_TOKEN='), `TELEGRAM_TOKEN= in ${file}`);
      assert.ok(!content.includes('DATABASE_URL='), `DATABASE_URL= in ${file}`);
    }
  });

  // 14. No forbidden patterns in source
  await runTest('No direct git push/deploy in improvement modules', () => {
    const srcDir = path.resolve(__dirname, '../src/improvement');
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js') && f !== 'improvement-evaluation-gate.js');
    const forbidden = ['git push', 'deployToProduction', 'rollbackProduction'];
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      for (const pattern of forbidden) {
        assert.ok(!content.includes(pattern), `Forbidden pattern "${pattern}" in ${file}`);
      }
    }
  });

  // 15. Report generation works
  await runTest('Report generation works', () => {
    const report = reportGenerator.generateImprovementSummary('test_ws', { store: mockStore });
    assert.ok(report, 'report generated');
    assert.ok(report.title, 'has title');
    assert.ok(Array.isArray(report.sections), 'has sections');
    assert.ok(report.generatedAt, 'has timestamp');
    assert.ok(report.sections.length >= 4, 'has multiple sections');

    const weekly = reportGenerator.generateWeeklyImprovementReport('test_ws', { store: mockStore });
    assert.ok(weekly, 'weekly report generated');
    assert.ok(weekly.title.includes('Weekly'), 'is weekly report');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
