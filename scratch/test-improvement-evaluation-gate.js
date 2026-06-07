'use strict';

const assert = require('assert');

// Mock improvement-utils to add SECRET_PATTERNS export
const utilsPath = require.resolve('../src/improvement/improvement-utils');
const realUtils = require(utilsPath);
delete require.cache[utilsPath];
require.cache[utilsPath] = {
  id: utilsPath, filename: utilsPath, loaded: true,
  exports: {
    ...realUtils,
    SECRET_PATTERNS: [
      /token[=:]\s*\S+/gi,
      /secret[=:]\s*\S+/gi,
      /password[=:]\s*\S+/gi,
      /api_key[=:]\s*\S+/gi,
      /Authorization[=:]\s*\S+/gi,
      /Bearer\s+\S+/gi,
      /DATABASE_URL[=:]\s*\S+/gi,
      /REDIS_URL[=:]\s*\S+/gi,
      /TELEGRAM_TOKEN[=:]\s*\S+/gi,
      /GITHUB_TOKEN[=:]\s*\S+/gi,
      /\bsk-\w+/gi,
      /\bghp_\w+/gi,
    ],
  },
  children: [], paths: []
};

async function runTests() {
  console.log('=== test-improvement-evaluation-gate.js ===');
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

  const gate = require('../src/improvement/improvement-evaluation-gate');

  await runTest('runImprovementEvaluationGate returns result with passed/checks/failures', () => {
    const plan = { id: 'p1', title: 'Safe plan', description: 'Just a review', actions: [], riskLevel: 'low' };
    const result = gate.runImprovementEvaluationGate(plan);
    assert.ok(result, 'should return result');
    assert.ok('passed' in result, 'should have passed');
    assert.ok(Array.isArray(result.checks), 'should have checks array');
    assert.ok(Array.isArray(result.failures), 'should have failures array');
  });

  await runTest('assertImprovementSafety checks overall safety', () => {
    const evalResult = {
      planId: 'p2', title: 'Safe', description: 'Review only',
      actions: [], planText: 'Just reviewing the code',
      riskLevel: 'low', requiresApproval: true, approvalBoundary: 'owner'
    };
    const result = gate.assertImprovementSafety(evalResult);
    assert.ok(result.passed, 'safe plan should pass');
    assert.equal(result.failures.length, 0);
  });

  await runTest('assertNoDirectExternalWrite blocks push/deploy', () => {
    const evalResult = { planText: 'We need to git push to deploy to production' };
    const check = gate.assertNoDirectExternalWrite(evalResult);
    assert.ok(!check.passed, 'should detect push pattern');
    assert.ok(check.detail.includes('git push') || check.detail.includes('deploy'), 'detail should mention matched pattern');
  });

  await runTest('assertNoDirectExternalWrite passes for safe text', () => {
    const evalResult = { planText: 'Just reviewing dashboard code' };
    const check = gate.assertNoDirectExternalWrite(evalResult);
    assert.ok(check.passed, 'safe text should pass');
  });

  await runTest('assertNoSecretLeak detects secrets in plan', () => {
    const evalResult = { planText: 'TELEGRAM_TOKEN=abc123 is used in the code' };
    const check = gate.assertNoSecretLeak(evalResult);
    assert.ok(!check.passed, 'should detect secret pattern');
  });

  await runTest('assertNoSecretLeak passes for clean plan', () => {
    const evalResult = { planText: 'Review dashboard tabs' };
    const check = gate.assertNoSecretLeak(evalResult);
    assert.ok(check.passed, 'clean plan should pass');
  });

  await runTest('assertApprovalBoundary respects approval flow', () => {
    const valid = gate.assertApprovalBoundary({ approvalBoundary: 'owner' });
    assert.ok(valid.passed);
    const invalid = gate.assertApprovalBoundary({ approvalBoundary: 'anyone' });
    assert.ok(!invalid.passed, 'invalid boundary should fail');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
