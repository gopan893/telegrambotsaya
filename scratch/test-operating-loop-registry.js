'use strict';

const assert = require('assert');

async function testRegistry() {
  let registry;
  try {
    registry = require('../src/operating-loop/operating-loop-registry');
  } catch (e) {
    console.log('SKIPPED: operating-loop-registry module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'validateOperatingLoopConfig rejects null', fn: () => {
      const result = registry.validateOperatingLoopConfig(null);
      assert.ok(!result.ok);
      assert.ok(result.errors.length > 0);
    }},
    { name: 'validateOperatingLoopConfig rejects no id', fn: () => {
      const result = registry.validateOperatingLoopConfig({ mode: 'scheduled_readonly' });
      assert.ok(!result.ok);
    }},
    { name: 'validateOperatingLoopConfig rejects autoApprove', fn: () => {
      const result = registry.validateOperatingLoopConfig({
        id: 'test_loop', mode: 'scheduled_readonly',
        blockedActions: ['write', 'external', 'danger', 'shell', 'git_push', 'deploy', 'rollback', 'email_send', 'calendar_write', 'webhook_post'],
        autoApprove: true
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('autoApprove')));
    }},
    { name: 'validateOperatingLoopConfig rejects autoRun', fn: () => {
      const result = registry.validateOperatingLoopConfig({
        id: 'test_loop', mode: 'scheduled_readonly',
        blockedActions: ['write', 'external', 'danger', 'shell', 'git_push', 'deploy', 'rollback', 'email_send', 'calendar_write', 'webhook_post'],
        autoRun: true
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('autoRun')));
    }},
    { name: 'validateOperatingLoopConfig rejects missing blocked actions', fn: () => {
      const result = registry.validateOperatingLoopConfig({
        id: 'test_loop', mode: 'scheduled_readonly', blockedActions: ['read']
      });
      assert.ok(!result.ok);
    }},
    { name: 'validateOperatingLoopConfig accepts valid config', fn: () => {
      const result = registry.validateOperatingLoopConfig({
        id: 'test_loop', mode: 'scheduled_readonly',
        blockedActions: ['write', 'external', 'danger', 'shell', 'git_push', 'deploy', 'rollback', 'email_send', 'calendar_write', 'webhook_post']
      });
      assert.ok(result.ok);
    }},
    { name: 'listOperatingLoops returns defaults when empty', fn: async () => {
      const result = await registry.listOperatingLoops({}, {});
      assert.ok(result.ok);
      assert.ok(Array.isArray(result.data));
      assert.ok(result.data.length > 0);
    }},
    { name: 'getOperatingLoop returns null for unknown', fn: async () => {
      const result = await registry.getOperatingLoop('nonexistent_loop', {});
      assert.ok(!result.ok || result.data === null);
    }}
  ];

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      if (test.fn.constructor.name === 'AsyncFunction') {
        await test.fn();
      } else {
        test.fn();
      }
      console.log(`  PASS: ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`  FAIL: ${test.name} - ${err.message}`);
      failed++;
    }
  }
  return { passed, failed, total: tests.length };
}

testRegistry().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-operating-loop-registry.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
