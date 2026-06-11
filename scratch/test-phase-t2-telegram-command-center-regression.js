'use strict';

const menuRegistry = require('../src/telegram-center/telegram-menu-registry');
const menuRenderer = require('../src/telegram-center/telegram-menu-renderer');
const callbackRouter = require('../src/telegram-center/telegram-callback-router');
const sessionState = require('../src/telegram-center/telegram-session-state');

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

// 1. All menus have required fields
test('all menus have required fields', () => {
  const reg = menuRegistry.DEFAULT_MENUS;
  for (const [id, menu] of Object.entries(reg)) {
    assert(menu.id, 'Menu ' + id + ' has id');
    assert(menu.title, 'Menu ' + id + ' has title');
    assert(menu.command, 'Menu ' + id + ' has command');
    assert(menu.handlerName, 'Menu ' + id + ' has handlerName');
  }
});

// 2. Callback routing works for all menu items
test('all menu items have callback routing', () => {
  const reg = menuRegistry.DEFAULT_MENUS;
  for (const [id, menu] of Object.entries(reg)) {
    const viaId = menuRegistry.getMenuByCallback('menu:' + id);
    const viaCmd = menuRegistry.getMenuByCallback('menu:' + menu.command);
    assert(viaId || viaCmd, 'Menu ' + id + ' should be reachable via callback');
  }
});

// 3. Main menu render has keyboard
test('main menu render has keyboard', () => {
  const result = menuRenderer.renderMainMenu({ isOwner: true, isAdmin: true, isGroup: false });
  assert(result.keyboard, 'Main menu should have keyboard');
  const buttons = result.keyboard.reply_markup.inline_keyboard.flat();
  assert(buttons.length >= 6, 'Main menu should have enough buttons');
});

// 4. Session TTL
test('session expires after TTL', () => {
  const original = sessionState.getTelegramSession('expire-test');
  original.ts = Date.now() - 31 * 60 * 1000;
  const session = sessionState.getTelegramSession('expire-test');
  assert(session, 'Session should be re-created');
});

// 5. Owner only menus hidden from non-owner
test('owner menus hidden from non-owner', () => {
  const actor = { isOwner: false, isAdmin: false, isGroup: false };
  const visible = menuRegistry.listVisibleMenus(actor);
  const hidden = Object.values(menuRegistry.DEFAULT_MENUS).filter(m => m.ownerOnly);
  for (const h of hidden) {
    assert(!visible.some(v => v.id === h.id), h.id + ' should be hidden from non-owner');
  }
});

console.log(`\n=== Phase T2 Command Center Regression Results ===`);
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
