'use strict';

const presenter = require('../src/telegram-ux/telegram-progress-presenter');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS:', name);
  } catch (e) {
    fail++;
    console.error('  FAIL:', name, '-', e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// Test presentLongTaskStarted
test('presentLongTaskStarted', () => {
  const ctx = { chatId: 123 };
  const result = presenter.presentLongTaskStarted(ctx, 'testing');
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].includes('testing'), 'Should include task name');
});

test('presentLongTaskStarted without ctx', () => {
  const result = presenter.presentLongTaskStarted(null, 'testing');
  assert(result.parts.length > 0, 'Should still return parts');
});

// Test presentLongTaskCompleted
test('presentLongTaskCompleted with string', () => {
  const ctx = { chatId: 123 };
  const result = presenter.presentLongTaskCompleted(ctx, 'All done');
  assert(result.parts[0].includes('Selesai'), 'Should show completion');
});

test('presentLongTaskCompleted without ctx', () => {
  const result = presenter.presentLongTaskCompleted(null, 'Done');
  assert(result.parts.length > 0, 'Should still return parts');
});

// Test presentLongTaskFailed
test('presentLongTaskFailed', () => {
  const ctx = { chatId: 123 };
  const err = new Error('Failed reason');
  const result = presenter.presentLongTaskFailed(ctx, err);
  assert(result.parts.some(p => p.includes('Gagal')), 'Should show failure');
});

test('presentLongTaskFailed redacts secret', () => {
  const ctx = { chatId: 123 };
  const err = new Error('Token: sk-abc123def456');
  const result = presenter.presentLongTaskFailed(ctx, err);
  assert(!result.parts.join(' ').includes('sk-abc123def456'), 'Should redact secret');
});

// Test sendProgressMessage
test('sendProgressMessage without proper ctx', () => {
  const result = presenter.sendProgressMessage({}, 'Working...');
  assert(result === null, 'Should return null without chatId');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
