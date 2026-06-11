'use strict';

const renderer = require('../src/telegram-ux/telegram-message-renderer');

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

// Test renderTelegramReply
test('renderTelegramReply with string', () => {
  const result = renderer.renderTelegramReply('Hello');
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].includes('Hello'), 'Should contain input');
});

test('renderTelegramReply with object', () => {
  const result = renderer.renderTelegramReply({ text: 'Test', keyboard: {} });
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].includes('Test'), 'Should contain text');
});

test('renderTelegramReply with null', () => {
  const result = renderer.renderTelegramReply(null);
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].includes('Tidak'), 'Should show fallback');
});

// Test renderShortAnswer
test('renderShortAnswer with string', () => {
  const result = renderer.renderShortAnswer('Short answer');
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].length <= 510, 'Should be short');
});

// Test renderSafeError
test('renderSafeError without stack trace', () => {
  const err = new Error('Test error');
  const result = renderer.renderSafeError(err);
  assert(result.parts.length > 0, 'Should have parts');
  assert(!result.parts[0].includes('Error:'), 'Should not include raw error');
});

// Test renderProposalSummary
test('renderProposalSummary', () => {
  const proposal = { id: '123', action: 'deploy', riskLevel: 'high', status: 'pending' };
  const result = renderer.renderProposalSummary(proposal);
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.keyboard, 'Should have keyboard');
});

// Test renderDegradedNotice
test('renderDegradedNotice', () => {
  const result = renderer.renderDegradedNotice('Service unavailable', { moduleName: 'Test' });
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.parts[0].includes('Test'), 'Should include module name');
});

// Test renderStatusCard
test('renderStatusCard', () => {
  const status = { bot: 'OK', ai: 'OK', storage: 'PostgreSQL', pendingApprovals: 2 };
  const result = renderer.renderStatusCard(status);
  assert(result.parts.length > 0, 'Should have parts');
  assert(result.keyboard, 'Should have keyboard');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
