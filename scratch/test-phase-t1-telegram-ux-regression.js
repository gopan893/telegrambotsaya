'use strict';

const renderer = require('../src/telegram-ux/telegram-message-renderer');
const splitter = require('../src/telegram-ux/telegram-message-splitter');
const sanitizer = require('../src/telegram-ux/telegram-markdown-sanitizer');
const keyboardBuilder = require('../src/telegram-ux/telegram-inline-keyboard-builder');
const errorPresenter = require('../src/telegram-ux/telegram-error-presenter');

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

// 1. Long message splitting
test('long message >4000 chars splits safely', () => {
  const longMsg = 'Test message.\n\n' + 'A'.repeat(5000);
  const parts = splitter.splitTelegramMessage(longMsg);
  assert(parts.length > 1, 'Should split');
  for (const p of parts) {
    assert(p.length <= 4100, 'No part exceeds 4096 + header');
  }
});

// 2. Code block preserved
test('code block preserved after split', () => {
  const msg = 'Code:\n```js\nconst x = 1;\n```\nEnd.';
  const parts = splitter.splitTelegramMessage(msg);
  assert(parts.length === 1, 'Short code block stays in one part');
  assert(parts[0].includes('```'), 'Code fences preserved');
});

// 3. Secret redaction in error
test('secret redacted in error presentation', () => {
  const err = new Error('GITHUB_TOKEN=ghp_abc123def456ghi');
  const result = errorPresenter.presentTelegramError(err);
  const text = result.parts.join(' ');
  assert(!text.includes('ghp_abc123def456ghi'), 'Secret redacted');
});

// 4. Main keyboard buttons
test('main keyboard has expected buttons', () => {
  const kb = keyboardBuilder.buildMainMenuKeyboard();
  assert(kb, 'Keyboard exists');
  const buttons = kb.reply_markup.inline_keyboard.flat().map(b => b.text);
  assert(buttons.includes('Status'), 'Has Status');
  assert(buttons.includes('Project'), 'Has Project');
  assert(buttons.includes('Coding'), 'Has Coding');
  assert(buttons.includes('Help'), 'Has Help');
});

// 5. No stack trace in safe error
test('safe error has no stack trace', () => {
  const result = renderer.renderSafeError(new Error('test'));
  const text = result.parts.join(' ');
  assert(!text.includes('at '), 'No stack trace');
  assert(!text.includes('/src/'), 'No file path');
});

// 6. Part header format
test('part headers correct format', () => {
  const parts = splitter.splitTelegramMessage('X'.repeat(5000), { maxLength: 1000 });
  assert(parts.length >= 2, 'Multiple parts');
  assert(parts[0].startsWith('Bagian 1/'), 'Header format correct');
  assert(parts[parts.length - 1].startsWith('Bagian ' + parts.length + '/'), 'Last header correct');
});

// 7. Dangerous callback data blocked
test('callback data is truncated to 64 chars', () => {
  const longData = 'A'.repeat(100);
  const btn = keyboardBuilder.button('Test', longData);
  assert(btn.callback_data.length <= 64, 'Callback data should be truncated to 64');
});

console.log(`\n=== Phase T1 Regression Results ===`);
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
