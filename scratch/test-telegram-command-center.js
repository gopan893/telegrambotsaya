'use strict';

const menuRegistry = require('../src/telegram-center/telegram-menu-registry');
const menuRenderer = require('../src/telegram-center/telegram-menu-renderer');
const callbackRouter = require('../src/telegram-center/telegram-callback-router');
const sessionState = require('../src/telegram-center/telegram-session-state');
const commandHelp = require('../src/telegram-center/telegram-command-help');

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

// Menu Registry
test('buildTelegramMenuRegistry', () => {
  const reg = menuRegistry.buildTelegramMenuRegistry();
  assert(reg.main, 'Has main menu');
  assert(reg.status, 'Has status menu');
  assert(reg.coding, 'Has coding menu');
  assert(Object.keys(reg).length >= 10, 'Has at least 10 menus');
});

test('validateTelegramMenuRegistry valid', () => {
  const result = menuRegistry.validateTelegramMenuRegistry(menuRegistry.DEFAULT_MENUS);
  assert(result.ok, 'Default menus should be valid');
});

test('getMenuByCommand', () => {
  const menu = menuRegistry.getMenuByCommand('/menu');
  assert(menu, 'Should find /menu');
  assert(menu.id === 'main', 'Should be main menu');
});

test('getMenuByCallback', () => {
  const menu = menuRegistry.getMenuByCallback('menu:status');
  assert(menu, 'Should find by callback');
  assert(menu.id === 'status', 'Should be status menu');
});

test('listVisibleMenus owner', () => {
  const actor = { isOwner: true, isAdmin: true, isGroup: false };
  const visible = menuRegistry.listVisibleMenus(actor);
  assert(visible.length > 0, 'Owner should see menus');
  assert(visible.some(m => m.id === 'approval'), 'Owner sees approval');
});

test('listVisibleMenus non-owner', () => {
  const actor = { isOwner: false, isAdmin: false, isGroup: true };
  const visible = menuRegistry.listVisibleMenus(actor);
  assert(visible.length > 0, 'Non-owner should see some menus');
  assert(!visible.some(m => m.id === 'approval'), 'Non-owner should not see approval');
});

// Menu Renderer
test('renderMainMenu', () => {
  const result = menuRenderer.renderMainMenu({ isOwner: false, isAdmin: false, isGroup: false });
  assert(result.text.includes('Menu Utama'), 'Should show main menu title');
  assert(result.keyboard, 'Should have keyboard');
});

test('renderHelpMenu', () => {
  const result = menuRenderer.renderHelpMenu({ isOwner: false, isAdmin: false, isGroup: false });
  assert(result.text.includes('Bantuan'), 'Should show help');
});

// Callback Router
test('parseTelegramCallback', () => {
  const parsed = callbackRouter.parseTelegramCallback('menu:status');
  assert(parsed.domain === 'menu', 'Domain should be menu');
  assert(parsed.action === 'status', 'Action should be status');
});

test('parseTelegramCallback with id', () => {
  const parsed = callbackRouter.parseTelegramCallback('approval:view:123');
  assert(parsed.domain === 'approval', 'Domain should be approval');
  assert(parsed.action === 'view', 'Action should be view');
  assert(parsed.id === '123', 'ID should be 123');
});

test('parseTelegramCallback null', () => {
  const parsed = callbackRouter.parseTelegramCallback(null);
  assert(parsed === null, 'Null should return null');
});

// Session State
test('getTelegramSession creates new', () => {
  const session = sessionState.getTelegramSession('user1');
  assert(session, 'Session should exist');
  assert(session.userId === 'user1', 'User ID should match');
});

test('updateTelegramSession', () => {
  sessionState.updateTelegramSession('user2', { lastMenu: 'coding' });
  const session = sessionState.getTelegramSession('user2');
  assert(session.lastMenu === 'coding', 'Should update lastMenu');
});

test('clearTelegramSession', () => {
  sessionState.getTelegramSession('user3');
  sessionState.clearTelegramSession('user3');
  const session = sessionState.getTelegramSession('user3');
  assert(session.userId === 'user3', 'Session should be re-created after clear');
});

// Command Help
test('buildGeneralHelp', () => {
  const help = commandHelp.buildGeneralHelp({ isOwner: false, isAdmin: false, isGroup: false });
  assert(help.includes('Bantuan'), 'Should have help title');
  assert(help.includes('/menu'), 'Should mention /menu');
});

test('buildSafetyInfo', () => {
  const info = commandHelp.buildSafetyInfo();
  assert(info.includes('Keamanan'), 'Should have security info');
  assert(info.includes('Secret'), 'Should mention secret detection');
});

console.log(`\n=== Phase T2 Command Center Results ===`);
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
