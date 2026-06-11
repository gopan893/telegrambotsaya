'use strict';

const presenter = require('../src/telegram-ux/telegram-error-presenter');

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

// Test presentTelegramError
test('presentTelegramError basic', () => {
  const err = new Error('Test error');
  const result = presenter.presentTelegramError(err);
  assert(result.parts.length > 0, 'Should have parts');
  assert(!result.parts[0].includes('Error:'), 'Should not include raw error');
  assert(result.keyboard, 'Should have keyboard');
});

test('presentTelegramError without stack trace', () => {
  const err = new Error('Something went wrong');
  const result = presenter.presentTelegramError(err);
  assert(!result.parts.join(' ').includes(err.stack), 'Stack trace should not appear');
});

test('presentTelegramError with secret', () => {
  const err = new Error('Token: sk-abc123def456');
  const result = presenter.presentTelegramError(err);
  assert(!result.parts.join(' ').includes('sk-abc123def456'), 'Secret should be redacted');
});

// Test presentSafeUserError
test('presentSafeUserError basic', () => {
  const result = presenter.presentSafeUserError('Terjadi kesalahan');
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].includes('Terjadi'), 'Should include message');
});

test('presentSafeUserError with suggestion', () => {
  const result = presenter.presentSafeUserError('Gagal', { suggestion: 'Coba lagi' });
  assert(result.parts.some(p => p.includes('Coba lagi')), 'Should include suggestion');
});

// Test presentModuleDegraded
test('presentModuleDegraded', () => {
  const result = presenter.presentModuleDegraded('AI Pipeline', 'Service down');
  assert(result.parts.some(p => p.includes('AI Pipeline')), 'Should include module name');
});

// Test presentPermissionDenied
test('presentPermissionDenied', () => {
  const result = presenter.presentPermissionDenied('Anda tidak memiliki akses');
  assert(result.parts.length > 0, 'Should have parts');
});

// Test presentApprovalRequired
test('presentApprovalRequired', () => {
  const result = presenter.presentApprovalRequired('deploy');
  assert(result.parts.some(p => p.includes('approve')), 'Should mention approve');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
