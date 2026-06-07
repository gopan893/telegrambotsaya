'use strict';

const assert = require('assert');

async function runTests() {
  console.log('=== test-quality-signal-classifier.js ===');
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

  const classifier = require('../src/improvement/quality-signal-classifier');

  await runTest('classifyQualitySignal returns category/severity/confidence', () => {
    const signal = classifier.classifyQualitySignal('Secret token exposed in logs!');
    assert.ok(signal.category, 'should have category');
    assert.ok(signal.severity, 'should have severity');
    assert.ok(typeof signal.confidence === 'number', 'confidence should be a number');
    assert.ok(signal.affectedModule, 'should have affectedModule');
    assert.ok(signal.likelyCause, 'should have likelyCause');
    assert.ok(signal.recommendedActionType, 'should have recommendedActionType');
    assert.strictEqual(typeof signal.safetyRelevant, 'boolean', 'safetyRelevant should be boolean');
  });

  await runTest('classifyQualitySignal detects critical severity', () => {
    const signal = classifier.classifyQualitySignal('secret leak in executor bypass');
    assert.strictEqual(signal.severity, 'critical');
    assert.strictEqual(signal.category, 'secret_safety');
    assert.strictEqual(signal.confidence, 0.95);
    assert.strictEqual(signal.safetyRelevant, true);
  });

  await runTest('classifyFeedbackCategory maps text to categories', () => {
    const fb1 = { rawTextRedacted: 'dashboard bug tampilan error' };
    assert.strictEqual(classifier.classifyFeedbackCategory(fb1), 'dashboard_bug');
    const fb2 = { rawTextRedacted: 'biaya mahal' };
    assert.strictEqual(classifier.classifyFeedbackCategory(fb2), 'cost_too_high');
    const fb3 = { summary: 'telegram command error' };
    assert.strictEqual(classifier.classifyFeedbackCategory(fb3), 'telegram_command_bug');
  });

  await runTest('classifyOutcomeQuality assesses outcome quality', () => {
    const failed = classifier.classifyOutcomeQuality({ status: 'failed' });
    assert.strictEqual(failed.severity, 'high');
    assert.strictEqual(failed.category, 'outcome_quality');
    assert.strictEqual(failed.recommendedActionType, 'investigate_outcome');
    const success = classifier.classifyOutcomeQuality({ status: 'success' });
    assert.strictEqual(success.severity, 'low');
    assert.strictEqual(success.recommendedActionType, 'monitor');
  });

  await runTest('detectSafetyRelevantSignal detects secret/approval bypass', () => {
    assert.strictEqual(classifier.detectSafetyRelevantSignal('secret token exposed'), true);
    assert.strictEqual(classifier.detectSafetyRelevantSignal('executor bypass detected'), true);
    assert.strictEqual(classifier.detectSafetyRelevantSignal('direct write danger'), true);
    assert.strictEqual(classifier.detectSafetyRelevantSignal('normal feedback text'), false);
  });

  await runTest('buildQualitySignalSummary builds readable summary', () => {
    const signal = { severity: 'high', category: 'deploy_failure', affectedModule: 'deploy', safetyRelevant: true, confidence: 0.85, likelyCause: 'timeout', recommendedActionType: 'rollback_deploy' };
    const summary = classifier.buildQualitySignalSummary(signal);
    assert.ok(summary.includes('HIGH'), 'should include severity');
    assert.ok(summary.includes('deploy_failure'), 'should include category');
    assert.ok(summary.includes('85%'), 'should include confidence');
    assert.ok(summary.includes('rollback_deploy'), 'should include action');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
