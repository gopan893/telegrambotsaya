'use strict';

const assert = require('assert');
const { ImprovementStore } = require('../src/improvement/improvement-store');

async function runTests() {
  console.log('=== test-regression-case-generator.js ===');
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

  const gen = require('../src/improvement/regression-case-generator');
  const store = new ImprovementStore();
  const services = { store };

  await runTest('generateRegressionCaseFromWeakness creates regression case', async () => {
    const weakness = store.add('weaknesses', {
      id: 'w_reg_1', title: 'Dashboard tab missing after deploy',
      targetModule: 'dashboard', description: 'Some tabs not showing',
      severity: 'high'
    });
    const regCase = gen.generateRegressionCaseFromWeakness('w_reg_1', services);
    assert.ok(regCase, 'should return regression case');
    assert.ok(regCase.id, 'should have id');
    assert.ok(regCase.title.includes('Regression'), 'title should start with Regression');
    assert.equal(regCase.targetModule, 'dashboard');
    assert.equal(regCase.sourceWeaknessId, 'w_reg_1');
  });

  await runTest('generateRegressionCaseFromWeakness throws for missing weakness', () => {
    assert.throws(() => gen.generateRegressionCaseFromWeakness('nonexistent', services), /Weakness not found/);
  });

  await runTest('generateRegressionCaseFromFeedback creates regression case', async () => {
    const fb = store.add('feedback', {
      id: 'fb_reg_1', title: 'Slow response time',
      summary: 'Bot responses taking too long',
      module: 'telegram', targetModule: 'telegram'
    });
    const regCase = gen.generateRegressionCaseFromFeedback('fb_reg_1', services);
    assert.ok(regCase, 'should return regression case');
    assert.equal(regCase.sourceFeedbackId, 'fb_reg_1');
    assert.ok(regCase.riskLevel, 'should have riskLevel');
  });

  await runTest('suggestTestFileForRegression suggests test file path', () => {
    const suggestion = gen.suggestTestFileForRegression({ targetModule: 'dashboard', title: 'Test' }, services);
    assert.ok(typeof suggestion === 'string', 'should return string');
    assert.ok(suggestion.startsWith('scratch/test-regression-'), 'should start with scratch/test-regression-');
  });

  await runTest('buildRegressionCaseSpec builds detailed spec', () => {
    const spec = gen.buildRegressionCaseSpec({
      title: 'Test reg',
      targetModule: 'deploy',
      riskLevel: 'high',
      scenario: 'Deploy should not fail',
      expectedBehavior: 'Deploy succeeds',
      failureToPrevent: 'Deploy fails'
    }, services);
    assert.ok(spec.title, 'should have title');
    assert.equal(spec.targetModule, 'deploy');
    assert.equal(spec.riskLevel, 'high');
    assert.ok(Array.isArray(spec.manualTestSteps), 'should have manualTestSteps');
    assert.ok(spec.manualTestSteps.length > 2, 'high risk should have more steps');
  });

  await runTest('Risk level is set appropriately', () => {
    const high = gen.buildRegressionCaseSpec({ title: 'critical crash data loss', riskLevel: 'high' });
    assert.equal(high.riskLevel, 'high');
    const med = gen.buildRegressionCaseSpec({ title: 'error bug regression', riskLevel: 'medium' });
    assert.equal(med.riskLevel, 'medium');
    const low = gen.buildRegressionCaseSpec({ title: 'minor visual issue', riskLevel: 'low' });
    assert.equal(low.riskLevel, 'low');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
