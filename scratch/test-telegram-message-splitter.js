'use strict';

const splitter = require('../src/telegram-ux/telegram-message-splitter');

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

// Test splitTelegramMessage
test('splitTelegramMessage short text', () => {
  const parts = splitter.splitTelegramMessage('Hello');
  assert(parts.length === 1, 'Short text should not be split');
});

test('splitTelegramMessage long text', () => {
  const longText = 'A'.repeat(5000);
  const parts = splitter.splitTelegramMessage(longText);
  assert(parts.length > 1, 'Long text should be split');
  parts.forEach(p => assert(p.length <= 4100, 'Each part should be under limit'));
});

test('splitTelegramMessage with headers', () => {
  const longText = 'B'.repeat(4000);
  const parts = splitter.splitTelegramMessage(longText, { maxLength: 2000 });
  assert(parts.length > 1, 'Should split');
  assert(parts[0].startsWith('Bagian 1/'), 'First part should have header');
  assert(parts[1].startsWith('Bagian 2/'), 'Second part should have header');
});

// Test splitByParagraph
test('splitByParagraph', () => {
  const text = 'Para1.\n\nPara2.\n\nPara3.\n\nPara4.';
  const parts = splitter.splitByParagraph(text, 10);
  assert(parts.length > 1, 'Should split');
});

// Test validateTelegramMessageLength
test('validateTelegramMessageLength valid', () => {
  const result = splitter.validateTelegramMessageLength(['short', 'parts']);
  assert(result.ok, 'Should be valid');
});

test('validateTelegramMessageLength too long part', () => {
  const longPart = 'A'.repeat(5000);
  const result = splitter.validateTelegramMessageLength([longPart]);
  assert(!result.ok, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have error');
});

// Test empty input
test('splitTelegramMessage empty', () => {
  const parts = splitter.splitTelegramMessage('');
  assert(parts.length === 0, 'Empty text should return empty array');
});

test('splitTelegramMessage null', () => {
  const parts = splitter.splitTelegramMessage(null);
  assert(parts.length === 0, 'Null should return empty array');
});

// Test code block preservation
test('splitTelegramMessage preserves code blocks', () => {
  const text = 'Some text\n```js\nconst x = 1;\n```\nMore text';
  const parts = splitter.splitTelegramMessage(text, { maxLength: 2000 });
  assert(parts.length === 1, 'Short code block should not be split');
  assert(parts[0].includes('```'), 'Code fences preserved');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
