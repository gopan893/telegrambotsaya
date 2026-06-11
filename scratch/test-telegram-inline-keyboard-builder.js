'use strict';

const builder = require('../src/telegram-ux/telegram-inline-keyboard-builder');

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

// Test buildMainMenuKeyboard
test('buildMainMenuKeyboard', () => {
  const kb = builder.buildMainMenuKeyboard();
  assert(kb, 'Should return keyboard');
  assert(kb.reply_markup.inline_keyboard.length > 0, 'Should have rows');
  assert(kb.reply_markup.inline_keyboard[0].length <= 2, 'Max 2 columns');
});

// Test buildCodingKeyboard
test('buildCodingKeyboard', () => {
  const kb = builder.buildCodingKeyboard();
  assert(kb, 'Should return keyboard');
  const buttons = kb.reply_markup.inline_keyboard.flat();
  assert(buttons.some(b => b.text === 'Make Plan'), 'Should have Make Plan');
});

// Test buildApprovalKeyboard
test('buildApprovalKeyboard', () => {
  const kb = builder.buildApprovalKeyboard('proposal123');
  assert(kb, 'Should return keyboard');
  const buttons = kb.reply_markup.inline_keyboard.flat();
  assert(buttons.some(b => b.text === 'Approve'), 'Should have Approve');
  assert(buttons.some(b => b.text === 'Reject'), 'Should have Reject');
});

test('buildApprovalKeyboard without id', () => {
  const kb = builder.buildApprovalKeyboard(null);
  assert(kb, 'Should return back keyboard');
});

// Test buildDeviceKeyboard
test('buildDeviceKeyboard', () => {
  const kb = builder.buildDeviceKeyboard('device1');
  assert(kb, 'Should return keyboard');
  const buttons = kb.reply_markup.inline_keyboard.flat();
  assert(buttons.some(b => b.text === 'Health'), 'Should have Health');
});

// Test buildSafeBackKeyboard
test('buildSafeBackKeyboard', () => {
  const kb = builder.buildSafeBackKeyboard();
  assert(kb, 'Should return keyboard');
  const buttons = kb.reply_markup.inline_keyboard.flat();
  assert(buttons.some(b => b.text === 'Back'), 'Should have Back');
});

// Test button
test('button basic', () => {
  const btn = builder.button('Test', 'data:123');
  assert(btn.text === 'Test', 'Should set text');
  assert(btn.callback_data === 'data:123', 'Should set callback_data');
});

test('button truncation', () => {
  const longText = 'A'.repeat(50);
  const longData = 'B'.repeat(100);
  const btn = builder.button(longText, longData);
  assert(btn.text.length <= 32, 'Text should be truncated to 32');
  assert(btn.callback_data.length <= 64, 'Data should be truncated to 64');
});

// Test inlineKeyboard
test('inlineKeyboard empty', () => {
  const kb = builder.inlineKeyboard([]);
  assert(kb === null, 'Empty should return null');
});

test('inlineKeyboard with rows', () => {
  const kb = builder.inlineKeyboard([
    [{ text: 'A', callback_data: 'a' }, { text: 'B', callback_data: 'b' }]
  ]);
  assert(kb, 'Should return keyboard');
  assert(kb.reply_markup.inline_keyboard.length === 1, 'Should have 1 row');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
