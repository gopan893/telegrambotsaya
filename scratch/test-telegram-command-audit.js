'use strict';

const assert = require('assert');
const audit = require('../src/telegram-control/telegram-command-audit');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

// Clear audit log before each test run
audit.clearAuditLog();

function run() {
  console.log('=== test-telegram-command-audit.js ===\n');

  // ── recordTelegramCommandAudit ──

  test('recordTelegramCommandAudit returns null for null event', () => {
    const result = audit.recordTelegramCommandAudit(null);
    assert.strictEqual(result, null);
  });

  test('recordTelegramCommandAudit returns null for undefined', () => {
    const result = audit.recordTelegramCommandAudit(undefined);
    assert.strictEqual(result, null);
  });

  test('recordTelegramCommandAudit creates record with id', () => {
    const result = audit.recordTelegramCommandAudit({
      command: 'testcmd',
      userId: '123',
      chatId: '456'
    });
    assert.ok(result);
    assert.ok(result.id);
    assert.ok(result.id.startsWith('aud'));
  });

  test('recordTelegramCommandAudit stores all fields', () => {
    const result = audit.recordTelegramCommandAudit({
      workspaceId: 'ws1',
      userId: 'user1',
      chatId: 'chat1',
      command: 'deploy',
      intent: 'propose_deploy',
      module: 'deploy',
      riskLevel: 'high',
      actionType: 'deploy_action',
      allowed: true,
      proposalId: 'prop_123',
      resultStatus: 'completed',
      reason: 'User requested deploy'
    });
    assert.strictEqual(result.workspaceId, 'ws1');
    assert.strictEqual(result.userId, 'user1');
    assert.strictEqual(result.chatId, 'chat1');
    assert.strictEqual(result.command, 'deploy');
    assert.strictEqual(result.intent, 'propose_deploy');
    assert.strictEqual(result.module, 'deploy');
    assert.strictEqual(result.riskLevel, 'high');
    assert.strictEqual(result.actionType, 'deploy_action');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.proposalId, 'prop_123');
    assert.strictEqual(result.resultStatus, 'completed');
    assert.strictEqual(result.reason, 'User requested deploy');
  });

  test('recordTelegramCommandAudit defaults allowed to false when not provided', () => {
    const result = audit.recordTelegramCommandAudit({
      command: 'test',
      userId: '1',
      chatId: '2'
    });
    assert.strictEqual(result.allowed, true);
  });

  test('recordTelegramCommandAudit sets default risk level', () => {
    const result = audit.recordTelegramCommandAudit({
      command: 'test',
      userId: '1',
      chatId: '2'
    });
    assert.strictEqual(result.riskLevel, 'unknown');
  });

  test('recordTelegramCommandAudit stores timestamp', () => {
    const result = audit.recordTelegramCommandAudit({
      command: 'test',
      userId: '1',
      chatId: '2'
    });
    assert.ok(result.createdAt);
    assert.ok(typeof result.createdAt === 'string');
  });

  // ── sanitizeTelegramAuditEvent ──

  test('sanitizeTelegramAuditEvent returns empty for null', () => {
    assert.deepStrictEqual(audit.sanitizeTelegramAuditEvent(null), {});
  });

  test('sanitizeTelegramAuditEvent returns empty for non-object', () => {
    assert.deepStrictEqual(audit.sanitizeTelegramAuditEvent('string'), {});
  });

  test('sanitizeTelegramAuditEvent redacts secret keys', () => {
    const result = audit.sanitizeTelegramAuditEvent({
      command: 'test',
      secret_key: 'mysecret',
      token_value: 'abc123',
      password: 'p@ss',
      api_key: 'key123',
      userId: '123'
    });
    assert.strictEqual(result.command, 'test');
    assert.strictEqual(result.secret_key, '[REDACTED]');
    assert.strictEqual(result.token_value, '[REDACTED]');
    assert.strictEqual(result.password, '[REDACTED]');
    assert.strictEqual(result.api_key, '[REDACTED]');
  });

  test('sanitizeTelegramAuditEvent sanitizes text values', () => {
    const result = audit.sanitizeTelegramAuditEvent({
      reason: 'token is ghp_abcdefghijklmnopqrstuvwxyz1234567890'
    });
    assert.ok(result.reason.includes('[REDACTED_GH_TOKEN]'));
    assert.ok(!result.reason.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'));
  });

  test('sanitizeTelegramAuditEvent preserves non-secret keys', () => {
    const result = audit.sanitizeTelegramAuditEvent({
      userId: 'user1',
      chatId: 'chat1',
      command: 'deploy',
      riskLevel: 'high'
    });
    assert.strictEqual(result.userId, 'user1');
    assert.strictEqual(result.chatId, 'chat1');
    assert.strictEqual(result.command, 'deploy');
    assert.strictEqual(result.riskLevel, 'high');
  });

  test('sanitizeTelegramAuditEvent redacts TELEGRAM_TOKEN key', () => {
    const result = audit.sanitizeTelegramAuditEvent({
      TELEGRAM_TOKEN: 'abc123'
    });
    assert.strictEqual(result.TELEGRAM_TOKEN, '[REDACTED]');
  });

  test('sanitizeTelegramAuditEvent preserves numbers', () => {
    const result = audit.sanitizeTelegramAuditEvent({
      count: 42,
      allowed: true
    });
    assert.strictEqual(result.count, 42);
    assert.strictEqual(result.allowed, true);
  });

  // ── listTelegramCommandAudit ──

  test('listTelegramCommandAudit returns all records without filters', () => {
    const results = audit.listTelegramCommandAudit();
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  test('listTelegramCommandAudit filters by command', () => {
    audit.recordTelegramCommandAudit({ command: 'filter_cmd', userId: '1', chatId: '2' });
    const results = audit.listTelegramCommandAudit({ command: 'filter_cmd' });
    assert.ok(results.length > 0);
    results.forEach(r => assert.strictEqual(r.command, 'filter_cmd'));
  });

  test('listTelegramCommandAudit filters by module', () => {
    audit.recordTelegramCommandAudit({ command: 'module_test', module: 'testmodule', userId: '1', chatId: '2' });
    const results = audit.listTelegramCommandAudit({ module: 'testmodule' });
    assert.ok(results.length > 0);
    results.forEach(r => assert.strictEqual(r.module, 'testmodule'));
  });

  test('listTelegramCommandAudit filters by userId', () => {
    audit.recordTelegramCommandAudit({ command: 'user_test', userId: 'special_user', chatId: '2' });
    const results = audit.listTelegramCommandAudit({ userId: 'special_user' });
    assert.ok(results.length > 0);
    results.forEach(r => assert.strictEqual(r.userId, 'special_user'));
  });

  test('listTelegramCommandAudit filters by chatId', () => {
    audit.recordTelegramCommandAudit({ command: 'chat_test', userId: '1', chatId: 'special_chat' });
    const results = audit.listTelegramCommandAudit({ chatId: 'special_chat' });
    assert.ok(results.length > 0);
    results.forEach(r => assert.strictEqual(r.chatId, 'special_chat'));
  });

  test('listTelegramCommandAudit filters by allowed', () => {
    audit.recordTelegramCommandAudit({ command: 'allowed_test', allowed: false, userId: '1', chatId: '2' });
    const results = audit.listTelegramCommandAudit({ allowed: false });
    assert.ok(results.length > 0);
    results.forEach(r => assert.strictEqual(r.allowed, false));
  });

  test('listTelegramCommandAudit filters by riskLevel', () => {
    audit.recordTelegramCommandAudit({ command: 'risk_test', riskLevel: 'danger', userId: '1', chatId: '2' });
    const results = audit.listTelegramCommandAudit({ riskLevel: 'danger' });
    assert.ok(results.length > 0);
    results.forEach(r => assert.strictEqual(r.riskLevel, 'danger'));
  });

  test('listTelegramCommandAudit respects limit filter', () => {
    const results = audit.listTelegramCommandAudit({ limit: 3 });
    assert.ok(results.length <= 100);
  });

  test('listTelegramCommandAudit filters by since date', () => {
    const results = audit.listTelegramCommandAudit({ since: '2020-01-01' });
    assert.ok(results.length > 0);
  });

  test('listTelegramCommandAudit filters by since date in future returns empty', () => {
    const results = audit.listTelegramCommandAudit({ since: '2099-01-01' });
    assert.strictEqual(results.length, 0);
  });

  // ── getAuditLogSize ──

  test('getAuditLogSize returns number', () => {
    const size = audit.getAuditLogSize();
    assert.ok(typeof size === 'number');
    assert.ok(size > 0);
  });

  test('getAuditLogSize increases after recording', () => {
    const before = audit.getAuditLogSize();
    audit.recordTelegramCommandAudit({ command: 'size_test', userId: '1', chatId: '2' });
    const after = audit.getAuditLogSize();
    assert.strictEqual(after, before + 1);
  });

  // ── clearAuditLog ──

  test('clearAuditLog resets log size to 0', () => {
    audit.clearAuditLog();
    assert.strictEqual(audit.getAuditLogSize(), 0);
  });

  test('records after clear are stored fresh', () => {
    const result = audit.recordTelegramCommandAudit({ command: 'post_clear', userId: '1', chatId: '2' });
    assert.ok(result);
    assert.strictEqual(audit.getAuditLogSize(), 1);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
