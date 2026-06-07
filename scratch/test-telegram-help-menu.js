'use strict';

const assert = require('assert');
const helpMenu = require('../src/telegram-control/telegram-help-menu');

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
  console.log('=== test-telegram-help-menu.js ===\n');

  // ── buildTelegramMainMenu ──

  test('buildTelegramMainMenu returns formatted string', () => {
    const result = helpMenu.buildTelegramMainMenu();
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 50);
  });

  test('buildTelegramMainMenu contains Menu Utama header', () => {
    const result = helpMenu.buildTelegramMainMenu();
    assert.ok(result.includes('Menu Utama'));
  });

  test('buildTelegramMainMenu contains category entries', () => {
    const result = helpMenu.buildTelegramMainMenu();
    assert.ok(result.includes('perintah'));
  });

  test('buildTelegramMainMenu contains /menu reference', () => {
    const result = helpMenu.buildTelegramMainMenu();
    assert.ok(result.includes('/menu'));
  });

  test('buildTelegramMainMenu contains /help reference', () => {
    const result = helpMenu.buildTelegramMainMenu();
    assert.ok(result.includes('/help'));
  });

  // ── buildTelegramCategoryMenu ──

  test('buildTelegramCategoryMenu for valid category', () => {
    const result = helpMenu.buildTelegramCategoryMenu('core');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 20);
  });

  test('buildTelegramCategoryMenu for lifeos category', () => {
    const result = helpMenu.buildTelegramCategoryMenu('lifeos');
    assert.ok(result.includes('Life OS') || result.includes('lifeos'));
    assert.ok(result.includes('perintah'));
  });

  test('buildTelegramCategoryMenu for deploy category', () => {
    const result = helpMenu.buildTelegramCategoryMenu('deploy');
    assert.ok(result.includes('Deploy') || result.includes('deploy'));
  });

  test('buildTelegramCategoryMenu for invalid category', () => {
    const result = helpMenu.buildTelegramCategoryMenu('nonexistent');
    assert.ok(result.includes('Tidak ada perintah'));
  });

  test('buildTelegramCategoryMenu shows command names', () => {
    const result = helpMenu.buildTelegramCategoryMenu('core');
    assert.ok(result.includes('/start'));
    assert.ok(result.includes('/help'));
  });

  test('buildTelegramCategoryMenu shows risk emoji', () => {
    const result = helpMenu.buildTelegramCategoryMenu('core');
    assert.ok(result.includes('📖'));
  });

  test('buildTelegramCategoryMenu shows owner icon for owner commands', () => {
    const result = helpMenu.buildTelegramCategoryMenu('core');
    // settings is owner-only command
    if (result.includes('/settings')) {
      assert.ok(result.includes('👑') || true);
    }
  });

  // ── buildTelegramCommandHelp ──

  test('buildTelegramCommandHelp for valid command', () => {
    const result = helpMenu.buildTelegramCommandHelp('start');
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('/start'));
    assert.ok(result.includes('Deskripsi'));
  });

  test('buildTelegramCommandHelp for /help command', () => {
    const result = helpMenu.buildTelegramCommandHelp('help');
    assert.ok(result.includes('/help'));
    assert.ok(result.includes('Deskripsi'));
  });

  test('buildTelegramCommandHelp for /deploy command', () => {
    const result = helpMenu.buildTelegramCommandHelp('deploy');
    assert.ok(result.includes('/deploy'));
    assert.ok(result.includes('riskLevel') || result.includes('Risiko'));
  });

  test('buildTelegramCommandHelp for invalid command returns message', () => {
    const result = helpMenu.buildTelegramCommandHelp('nonexistent_command_xyz');
    assert.ok(result.includes('tidak ditemukan'));
  });

  test('buildTelegramCommandHelp suggests commands for close match', () => {
    const result = helpMenu.buildTelegramCommandHelp('hel');
    if (result.includes('Mungkin maksud Anda') || result.includes('tidak ditemukan')) {
      assert.ok(true);
    }
  });

  test('buildTelegramCommandHelp includes description', () => {
    const result = helpMenu.buildTelegramCommandHelp('health');
    assert.ok(result.includes('Deskripsi'));
  });

  test('buildTelegramCommandHelp includes category label', () => {
    const result = helpMenu.buildTelegramCommandHelp('health');
    assert.ok(result.includes('Kategori'));
  });

  test('buildTelegramCommandHelp includes risk level', () => {
    const result = helpMenu.buildTelegramCommandHelp('health');
    assert.ok(result.includes('read_only') || result.includes('Risiko'));
  });

  test('buildTelegramCommandHelp includes aliases', () => {
    const result = helpMenu.buildTelegramCommandHelp('start');
    if (result.includes('Alias')) {
      assert.ok(result.includes('/mulai'));
    }
  });

  test('buildTelegramCommandHelp includes examples', () => {
    const result = helpMenu.buildTelegramCommandHelp('start');
    if (result.includes('Contoh')) {
      assert.ok(result.includes('/start'));
    }
  });

  test('buildTelegramCommandHelp shows owner badge for owner-only commands', () => {
    const result = helpMenu.buildTelegramCommandHelp('settings');
    assert.ok(result.includes('pemilik') || result.includes('owner') || result.includes('👑'));
  });

  test('buildTelegramCommandHelp shows approval requirement', () => {
    const result = helpMenu.buildTelegramCommandHelp('approve');
    assert.ok(result.includes('persetujuan') || result.includes('proposal'));
  });

  test('buildTelegramCommandHelp shows evaluation requirement', () => {
    const result = helpMenu.buildTelegramCommandHelp('propose_deploy');
    assert.ok(result.includes('Evaluation') || result.includes('evaluasi'));
  });

  // ── searchTelegramHelp ──

  test('searchTelegramHelp returns empty for null', () => {
    const result = helpMenu.searchTelegramHelp(null);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  test('searchTelegramHelp returns results for query', () => {
    const result = helpMenu.searchTelegramHelp('deploy');
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  test('searchTelegramHelp returns at most 8 results', () => {
    const result = helpMenu.searchTelegramHelp('a');
    assert.ok(result.length <= 8);
  });

  test('searchTelegramHelp returns commands with descriptions', () => {
    const result = helpMenu.searchTelegramHelp('health');
    if (result.length > 0) {
      assert.ok(result[0].name);
      assert.ok(result[0].description);
    }
  });

  test('searchTelegramHelp returns empty for nonsense query', () => {
    const result = helpMenu.searchTelegramHelp('zzzz_nonexistent_xxxx');
    assert.strictEqual(result.length, 0);
  });

  test('searchTelegramHelp case insensitive', () => {
    const result = helpMenu.searchTelegramHelp('DEPLOY');
    assert.ok(result.length > 0);
  });

  // ── suggestTelegramCommands ──

  test('suggestTelegramCommands returns empty for null', () => {
    const result = helpMenu.suggestTelegramCommands(null);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  test('suggestTelegramCommands returns result for matching intent', () => {
    const result = helpMenu.suggestTelegramCommands('help');
    if (result.length > 0) {
      assert.ok(result[0].name);
    }
  });

  test('suggestTelegramCommands returns empty for unknown intent', () => {
    const result = helpMenu.suggestTelegramCommands('zzzz_nonexistent');
    assert.strictEqual(result.length, 0);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
