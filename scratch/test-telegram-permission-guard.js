'use strict';

const assert = require('assert');
const guard = require('../src/telegram-control/telegram-permission-guard');

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

function makeCommand(overrides) {
  return {
    name: 'testcmd',
    module: 'core',
    category: 'core',
    description: 'Test command',
    riskLevel: 'read_only',
    requiresOwner: false,
    requiresAdmin: false,
    requiresApproval: false,
    ...overrides
  };
}

function makeUser(overrides) {
  return { id: 12345, ...overrides };
}

function makeChat(overrides) {
  return { id: 67890, ...overrides };
}

function setEnv(key, value) {
  process.env[key] = value;
}

function clearEnv(key) {
  delete process.env[key];
}

function run() {
  console.log('=== test-telegram-permission-guard.js ===\n');

  // Simple test function that handles ENV setup
  const originalEnv = { ...process.env };

  // ── checkTelegramCommandPermission with null command/user ──

  test('checkTelegramCommandPermission null command', () => {
    const result = guard.checkTelegramCommandPermission(null, makeUser());
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Command not found');
  });

  test('checkTelegramCommandPermission null user', () => {
    const result = guard.checkTelegramCommandPermission(makeCommand(), null);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'User not identified');
  });

  test('checkTelegramCommandPermission null both', () => {
    const result = guard.checkTelegramCommandPermission(null, null);
    assert.strictEqual(result.allowed, false);
  });

  // ── Read-only command for any user ──

  test('checkTelegramCommandPermission read-only command allows non-owner', () => {
    const cmd = makeCommand({ riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser());
    assert.strictEqual(result.allowed, true);
  });

  // ── Owner-only command check ──

  test('checkTelegramCommandPermission owner-only command denied for non-owner', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    const cmd = makeCommand({ requiresOwner: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('owner'));
    clearEnv('OWNER_CHAT_ID');
  });

  test('checkTelegramCommandPermission owner-only command allowed for owner', () => {
    setEnv('OWNER_CHAT_ID', '12345');
    const cmd = makeCommand({ requiresOwner: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
  });

  test('checkTelegramCommandPermission owner-only via chatId', () => {
    setEnv('OWNER_CHAT_ID', '67890');
    const cmd = makeCommand({ requiresOwner: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }), makeChat({ id: 67890 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
  });

  // ── Admin-only command check ──

  test('checkTelegramCommandPermission admin-only denied for non-admin', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    setEnv('ADMIN_IDS', '11111,22222');
    const cmd = makeCommand({ requiresAdmin: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('admin'));
    clearEnv('OWNER_CHAT_ID');
    clearEnv('ADMIN_IDS');
  });

  test('checkTelegramCommandPermission admin-only allowed for admin', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    setEnv('ADMIN_IDS', '11111,12345');
    const cmd = makeCommand({ requiresAdmin: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
    clearEnv('ADMIN_IDS');
  });

  test('checkTelegramCommandPermission admin-only allowed for owner', () => {
    setEnv('OWNER_CHAT_ID', '12345');
    const cmd = makeCommand({ requiresAdmin: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
  });

  test('checkTelegramCommandPermission admin via chatId in ADMIN_IDS', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    setEnv('ADMIN_IDS', '11111,67890');
    const cmd = makeCommand({ requiresAdmin: true });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }), makeChat({ id: 67890 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
    clearEnv('ADMIN_IDS');
  });

  // ── High-risk command check ──

  test('checkTelegramCommandPermission high-risk denied for non-admin', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    setEnv('ADMIN_IDS', '');
    const cmd = makeCommand({ riskLevel: 'high' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, false);
    clearEnv('OWNER_CHAT_ID');
    clearEnv('ADMIN_IDS');
  });

  test('checkTelegramCommandPermission danger-risk denied for non-admin', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    const cmd = makeCommand({ riskLevel: 'danger' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, false);
    clearEnv('OWNER_CHAT_ID');
  });

  test('checkTelegramCommandPermission high-risk allowed for admin', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    setEnv('ADMIN_IDS', '12345');
    const cmd = makeCommand({ riskLevel: 'high' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
    clearEnv('ADMIN_IDS');
  });

  test('checkTelegramCommandPermission danger-risk allowed for owner', () => {
    setEnv('OWNER_CHAT_ID', '12345');
    const cmd = makeCommand({ riskLevel: 'danger' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
  });

  // ── Life OS private data check ──

  test('checkTelegramCommandPermission lifeos module denied for non-owner', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    const cmd = makeCommand({ module: 'lifeos' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('Life OS'));
    clearEnv('OWNER_CHAT_ID');
  });

  test('checkTelegramCommandPermission lifeos module allowed for owner', () => {
    setEnv('OWNER_CHAT_ID', '12345');
    const cmd = makeCommand({ module: 'lifeos' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
  });

  test('checkTelegramCommandPermission non-lifeos module allowed for non-owner', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    const cmd = makeCommand({ module: 'core' });
    const result = guard.checkTelegramCommandPermission(cmd, makeUser({ id: 12345 }));
    assert.strictEqual(result.allowed, true);
    clearEnv('OWNER_CHAT_ID');
  });

  // ── buildPermissionDeniedResponse ──

  test('buildPermissionDeniedResponse returns default message', () => {
    const result = guard.buildPermissionDeniedResponse();
    assert.ok(result.includes('Akses ditolak'));
  });

  test('buildPermissionDeniedResponse includes reason', () => {
    const result = guard.buildPermissionDeniedResponse('Test reason');
    assert.ok(result.includes('Test reason'));
  });

  test('buildPermissionDeniedResponse with null reason', () => {
    const result = guard.buildPermissionDeniedResponse(null);
    assert.ok(result.includes('tidak memiliki izin'));
  });

  // ── requireOwner ──

  test('requireOwner returns false for null command and user', () => {
    assert.strictEqual(guard.requireOwner(null, null), false);
  });

  test('requireOwner returns false for mismatched user', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    assert.strictEqual(guard.requireOwner(makeCommand(), makeUser({ id: 12345 })), false);
    clearEnv('OWNER_CHAT_ID');
  });

  test('requireOwner returns true for matching user', () => {
    setEnv('OWNER_CHAT_ID', '12345');
    assert.strictEqual(guard.requireOwner(makeCommand(), makeUser({ id: 12345 })), true);
    clearEnv('OWNER_CHAT_ID');
  });

  // ── requireAdmin ──

  test('requireAdmin returns false for null command and user', () => {
    assert.strictEqual(guard.requireAdmin(null, null), false);
  });

  test('requireAdmin returns true for admin user', () => {
    setEnv('OWNER_CHAT_ID', '99999');
    setEnv('ADMIN_IDS', '12345');
    assert.strictEqual(guard.requireAdmin(makeCommand(), makeUser({ id: 12345 })), true);
    clearEnv('OWNER_CHAT_ID');
    clearEnv('ADMIN_IDS');
  });

  test('requireAdmin returns true for owner user', () => {
    setEnv('OWNER_CHAT_ID', '12345');
    assert.strictEqual(guard.requireAdmin(makeCommand(), makeUser({ id: 12345 })), true);
    clearEnv('OWNER_CHAT_ID');
  });

  // ── requireWorkspacePermission ──

  test('requireWorkspacePermission null command', () => {
    const result = guard.requireWorkspacePermission(null, makeUser());
    assert.strictEqual(result.allowed, false);
  });

  test('requireWorkspacePermission null user', () => {
    const result = guard.requireWorkspacePermission(makeCommand(), null);
    assert.strictEqual(result.allowed, false);
  });

  test('requireWorkspacePermission grants for non-owner command', () => {
    const result = guard.requireWorkspacePermission(makeCommand(), makeUser());
    assert.strictEqual(result.allowed, true);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
