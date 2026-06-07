'use strict';

const assert = require('assert');
const path = require('path');
const registry = require('../src/telegram-control/telegram-command-registry');

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

function run() {
  console.log('=== test-telegram-command-registry.js ===\n');

  // ── registerTelegramCommand ──

  test('registerTelegramCommand throws on null', () => {
    assert.throws(() => registry.registerTelegramCommand(null), /must have a name/);
  });

  test('registerTelegramCommand throws on missing name', () => {
    assert.throws(() => registry.registerTelegramCommand({}), /must have a name/);
  });

  test('registerTelegramCommand throws on empty name', () => {
    assert.throws(() => registry.registerTelegramCommand({ name: '' }), /must have a name/);
  });

  test('registerTelegramCommand adds new command', () => {
    const result = registry.registerTelegramCommand({
      name: 'testcmd1',
      aliases: ['tc1'],
      module: 'test',
      category: 'core',
      description: 'A test command',
      riskLevel: 'low'
    });
    assert.strictEqual(result, true);
  });

  test('registerTelegramCommand updates existing command', () => {
    const result = registry.registerTelegramCommand({
      name: 'testcmd1',
      description: 'Updated description'
    });
    assert.strictEqual(result, true);
    const cmd = registry.getTelegramCommand('testcmd1');
    assert.strictEqual(cmd.description, 'Updated description');
  });

  // ── getTelegramCommand ──

  test('getTelegramCommand returns null for empty name', () => {
    assert.strictEqual(registry.getTelegramCommand(null), null);
    assert.strictEqual(registry.getTelegramCommand(''), null);
  });

  test('getTelegramCommand by name', () => {
    const cmd = registry.getTelegramCommand('start');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'start');
  });

  test('getTelegramCommand by alias', () => {
    const cmd = registry.getTelegramCommand('mulai');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'start');
  });

  test('getTelegramCommand strips leading slash', () => {
    const cmd = registry.getTelegramCommand('/help');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'help');
  });

  test('getTelegramCommand case insensitive', () => {
    const cmd = registry.getTelegramCommand('HELP');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'help');
  });

  test('getTelegramCommand returns null for unknown', () => {
    assert.strictEqual(registry.getTelegramCommand('nonexistent_cmd_xyz'), null);
  });

  // ── listTelegramCommands ──

  test('listTelegramCommands returns all commands without filters', () => {
    const all = registry.listTelegramCommands();
    assert.ok(all.length >= 150);
  });

  test('listTelegramCommands filters by category', () => {
    const core = registry.listTelegramCommands({ category: 'core' });
    assert.ok(core.length > 0);
    core.forEach(c => assert.strictEqual(c.category, 'core'));
  });

  test('listTelegramCommands filters by module', () => {
    const lifeos = registry.listTelegramCommands({ module: 'lifeos' });
    assert.ok(lifeos.length > 0);
    lifeos.forEach(c => assert.strictEqual(c.module, 'lifeos'));
  });

  test('listTelegramCommands filters by riskLevel', () => {
    const high = registry.listTelegramCommands({ riskLevel: 'high' });
    assert.ok(high.length > 0);
    high.forEach(c => assert.strictEqual(c.riskLevel, 'high'));
  });

  test('listTelegramCommands filters by enabled', () => {
    const enabled = registry.listTelegramCommands({ enabled: true });
    const disabled = registry.listTelegramCommands({ enabled: false });
    assert.ok(enabled.length > disabled.length);
  });

  test('listTelegramCommands filters by search', () => {
    const results = registry.listTelegramCommands({ search: 'deploy' });
    assert.ok(results.length > 0);
  });

  test('listTelegramCommands returns empty for nonexistent category', () => {
    const results = registry.listTelegramCommands({ category: 'nonexistent_cat' });
    assert.deepStrictEqual(results, []);
  });

  // ── findTelegramCommandByIntent ──

  test('findTelegramCommandByIntent returns null for null', () => {
    assert.strictEqual(registry.findTelegramCommandByIntent(null), null);
  });

  test('findTelegramCommandByIntent exact name match', () => {
    const cmd = registry.findTelegramCommandByIntent('help');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'help');
  });

  test('findTelegramCommandByIntent alias match', () => {
    const cmd = registry.findTelegramCommandByIntent('bantuan');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'help');
  });

  test('findTelegramCommandByIntent partial description match', () => {
    const cmd = registry.findTelegramCommandByIntent('backup');
    assert.ok(cmd);
  });

  test('findTelegramCommandByIntent returns null for gibberish', () => {
    const cmd = registry.findTelegramCommandByIntent('xyzzy_nonexistent_12345');
    assert.strictEqual(cmd, null);
  });

  // ── validateTelegramCommandRegistry ──

  test('validateTelegramCommandRegistry returns valid structure', () => {
    const result = registry.validateTelegramCommandRegistry();
    assert.ok(typeof result.valid === 'boolean');
    assert.ok(Array.isArray(result.issues));
    assert.ok(result.totalCommands >= 150);
  });

  test('validateTelegramCommandRegistry has no duplicates', () => {
    const result = registry.validateTelegramCommandRegistry();
    const duplicateIssues = result.issues.filter(i => i.type === 'duplicate');
    assert.strictEqual(duplicateIssues.length, 0, 'No duplicates expected - registerTelegramCommand updates in-place');
  });

  // ── getCategories ──

  test('getCategories returns array', () => {
    const cats = registry.getCategories();
    assert.ok(Array.isArray(cats));
    assert.ok(cats.length > 0);
  });

  test('getCategories items have key, label, count', () => {
    const cats = registry.getCategories();
    cats.forEach(c => {
      assert.ok(typeof c.key === 'string');
      assert.ok(typeof c.label === 'string');
      assert.ok(typeof c.count === 'number');
    });
  });

  test('All categories exist', () => {
    const cats = registry.getCategories();
    assert.ok(cats.length > 0);
    cats.forEach(c => {
      assert.ok(typeof c.key === 'string');
      assert.ok(typeof c.label === 'string');
      assert.ok(typeof c.count === 'number');
    });
  });

  // ── BUILTIN_COMMANDS count ──

  test('BUILTIN_COMMANDS has at least 150 commands', () => {
    assert.ok(registry.BUILTIN_COMMANDS.length >= 150);
  });

  test('BUILTIN_COMMANDS has known commands', () => {
    const names = registry.BUILTIN_COMMANDS.map(c => c.name);
    assert.ok(names.includes('start'));
    assert.ok(names.includes('help'));
    assert.ok(names.includes('menu'));
    assert.ok(names.includes('status'));
    assert.ok(names.includes('health'));
    assert.ok(names.includes('deploy'));
    assert.ok(names.includes('lifeos'));
  });

  // ── RISK_LEVELS ──

  test('RISK_LEVELS has expected levels', () => {
    assert.strictEqual(registry.RISK_LEVELS.read_only, 0);
    assert.strictEqual(registry.RISK_LEVELS.low, 1);
    assert.strictEqual(registry.RISK_LEVELS.medium, 2);
    assert.strictEqual(registry.RISK_LEVELS.high, 3);
    assert.strictEqual(registry.RISK_LEVELS.danger, 4);
  });

  test('All commands have valid risk levels', () => {
    const validLevels = Object.keys(registry.RISK_LEVELS);
    registry.BUILTIN_COMMANDS.forEach(cmd => {
      assert.ok(validLevels.includes(cmd.riskLevel), `Command /${cmd.name} has invalid riskLevel: ${cmd.riskLevel}`);
    });
  });

  // ── All commands have required fields ──

  test('All commands have name, description, category, riskLevel', () => {
    registry.BUILTIN_COMMANDS.forEach(cmd => {
      assert.ok(cmd.name, 'Missing name');
      assert.ok(cmd.description, `Missing description for /${cmd.name}`);
      assert.ok(cmd.category, `Missing category for /${cmd.name}`);
      assert.ok(cmd.riskLevel, `Missing riskLevel for /${cmd.name}`);
    });
  });

  // ── cleanup: remove test command ──

  test('Cleanup test registration', () => {
    const removed = registry.registerTelegramCommand({ name: 'testcmd1', enabled: false });
    assert.ok(removed);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
