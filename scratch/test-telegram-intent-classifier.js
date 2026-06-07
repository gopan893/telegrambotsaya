'use strict';

const assert = require('assert');
const classifier = require('../src/telegram-control/telegram-intent-classifier');

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
  console.log('=== test-telegram-intent-classifier.js ===\n');

  // ── classifyTelegramIntent with /slash commands ──

  test('classifyTelegramIntent slash command /start', () => {
    const result = classifier.classifyTelegramIntent('/start');
    assert.strictEqual(result.intent, 'slash_command');
    assert.strictEqual(result.command, 'start');
    assert.strictEqual(result.confidence, 100);
  });

  test('classifyTelegramIntent slash command /help deploy', () => {
    const result = classifier.classifyTelegramIntent('/help deploy');
    assert.strictEqual(result.intent, 'slash_command');
    assert.strictEqual(result.command, 'help');
  });

  test('classifyTelegramIntent slash command /lifeos with args', () => {
    const result = classifier.classifyTelegramIntent('/lifeos daily plan');
    assert.strictEqual(result.intent, 'slash_command');
    assert.strictEqual(result.command, 'lifeos');
  });

  test('classifyTelegramIntent single / alone', () => {
    const result = classifier.classifyTelegramIntent('/');
    assert.strictEqual(result.intent, 'slash_command');
    assert.strictEqual(result.command, '');
  });

  // ── classifyTelegramIntent with various natural patterns ──

  test('classifyTelegramIntent "cek production health"', () => {
    const result = classifier.classifyTelegramIntent('cek production health');
    assert.strictEqual(result.intent, 'prod_health');
    assert.strictEqual(result.command, 'prodhealth');
  });

  test('classifyTelegramIntent "check production health"', () => {
    const result = classifier.classifyTelegramIntent('check production health');
    assert.strictEqual(result.intent, 'prod_health');
  });

  test('classifyTelegramIntent "lihat produksi"', () => {
    const result = classifier.classifyTelegramIntent('lihat produksi');
    assert.strictEqual(result.intent, 'unknown');
  });

  test('classifyTelegramIntent "ada insiden"', () => {
    const result = classifier.classifyTelegramIntent('ada insiden');
    assert.strictEqual(result.intent, 'list_incidents');
    assert.strictEqual(result.command, 'incidents');
  });

  test('classifyTelegramIntent "kenapa deploy gagal"', () => {
    const result = classifier.classifyTelegramIntent('kenapa deploy gagal');
    assert.strictEqual(result.intent, 'analyze_deploy_failure');
  });

  test('classifyTelegramIntent "kenapa gagal"', () => {
    const result = classifier.classifyTelegramIntent('kenapa gagal');
    assert.strictEqual(result.intent, 'analyze_incident');
    assert.strictEqual(result.command, 'analyze_incident');
  });

  test('classifyTelegramIntent "project mana yang harus saya lanjut"', () => {
    const result = classifier.classifyTelegramIntent('project mana yang harus saya lanjut');
    assert.strictEqual(result.intent, 'portfolio_next');
    assert.strictEqual(result.command, 'portfolio_next');
  });

  test('classifyTelegramIntent "buat rencana hari ini"', () => {
    const result = classifier.classifyTelegramIntent('buat rencana hari ini');
    assert.strictEqual(result.intent, 'daily_plan');
    assert.strictEqual(result.command, 'daily');
  });

  test('classifyTelegramIntent "bikin rencana minggu"', () => {
    const result = classifier.classifyTelegramIntent('bikin rencana minggu');
    assert.strictEqual(result.intent, 'weekly_plan');
    assert.strictEqual(result.command, 'weekly');
  });

  test('classifyTelegramIntent "selesaikan semua otomatis"', () => {
    const result = classifier.classifyTelegramIntent('selesaikan semua otomatis');
    assert.strictEqual(result.intent, 'refuse_full_auto');
  });

  test('classifyTelegramIntent "otomatiskan semua"', () => {
    const result = classifier.classifyTelegramIntent('otomatiskan semua');
    assert.strictEqual(result.intent, 'refuse_full_auto');
  });

  test('classifyTelegramIntent "berapa token hari ini"', () => {
    const result = classifier.classifyTelegramIntent('berapa token hari ini');
    assert.strictEqual(result.intent, 'usage_check');
    assert.strictEqual(result.command, 'usage');
  });

  test('classifyTelegramIntent "apa keputusan penting"', () => {
    const result = classifier.classifyTelegramIntent('apa keputusan penting');
    assert.strictEqual(result.intent, 'decision_memory');
    assert.strictEqual(result.command, 'decision_memory');
  });

  test('classifyTelegramIntent "halo" greeting', () => {
    const result = classifier.classifyTelegramIntent('halo');
    assert.strictEqual(result.intent, 'greeting');
  });

  test('classifyTelegramIntent "pagi" greeting', () => {
    const result = classifier.classifyTelegramIntent('pagi');
    assert.strictEqual(result.intent, 'greeting');
  });

  test('classifyTelegramIntent "terima kasih" thanks', () => {
    const result = classifier.classifyTelegramIntent('terima kasih');
    assert.strictEqual(result.intent, 'thanks');
  });

  test('classifyTelegramIntent "makasih" thanks', () => {
    const result = classifier.classifyTelegramIntent('makasih');
    assert.strictEqual(result.intent, 'thanks');
  });

  test('classifyTelegramIntent "help" help', () => {
    const result = classifier.classifyTelegramIntent('help');
    assert.strictEqual(result.intent, 'help');
    assert.strictEqual(result.command, 'help');
  });

  test('classifyTelegramIntent "tolong" help', () => {
    const result = classifier.classifyTelegramIntent('tolong');
    assert.strictEqual(result.intent, 'help');
  });

  test('classifyTelegramIntent "solusinya apa" followup', () => {
    const result = classifier.classifyTelegramIntent('solusinya apa');
    assert.strictEqual(result.intent, 'followup_answer');
  });

  test('classifyTelegramIntent "jawabannya" followup', () => {
    const result = classifier.classifyTelegramIntent('jawabannya');
    assert.strictEqual(result.intent, 'followup_answer');
  });

  test('classifyTelegramIntent "status bot" status', () => {
    const result = classifier.classifyTelegramIntent('status bot');
    assert.strictEqual(result.intent, 'status');
    assert.strictEqual(result.command, 'status');
  });

  test('classifyTelegramIntent "siapa saya" whoami', () => {
    const result = classifier.classifyTelegramIntent('siapa saya');
    assert.strictEqual(result.intent, 'whoami');
    assert.strictEqual(result.command, 'whoami');
  });

  test('classifyTelegramIntent "tugas saya hari ini" tasks', () => {
    const result = classifier.classifyTelegramIntent('tugas saya hari ini');
    assert.strictEqual(result.intent, 'tasks');
    assert.strictEqual(result.command, 'tasks');
  });

  test('classifyTelegramIntent "habit check" habits', () => {
    const result = classifier.classifyTelegramIntent('habit check');
    assert.strictEqual(result.intent, 'habits');
    assert.strictEqual(result.command, 'habits');
  });

  test('classifyTelegramIntent "mood hari ini" mood', () => {
    const result = classifier.classifyTelegramIntent('mood hari ini');
    assert.strictEqual(result.intent, 'mood');
    assert.strictEqual(result.command, 'mood');
  });

  test('classifyTelegramIntent "energy hari ini" energy', () => {
    const result = classifier.classifyTelegramIntent('energy hari ini');
    assert.strictEqual(result.intent, 'energy');
    assert.strictEqual(result.command, 'energy');
  });

  test('classifyTelegramIntent "focus session" focus', () => {
    const result = classifier.classifyTelegramIntent('focus session');
    assert.strictEqual(result.intent, 'focus');
    assert.strictEqual(result.command, 'focus');
  });

  test('classifyTelegramIntent "ingatkan" reminders', () => {
    const result = classifier.classifyTelegramIntent('ingatkan');
    assert.strictEqual(result.intent, 'reminders');
    assert.strictEqual(result.command, 'reminders');
  });

  test('classifyTelegramIntent "knowledge tentang" knowledge_search', () => {
    const result = classifier.classifyTelegramIntent('knowledge tentang coding');
    assert.strictEqual(result.intent, 'knowledge_search');
    assert.strictEqual(result.command, 'knowledge_search');
  });

  test('classifyTelegramIntent "portfolio status" portfolio', () => {
    const result = classifier.classifyTelegramIntent('portfolio status');
    assert.strictEqual(result.intent, 'portfolio');
    assert.strictEqual(result.command, 'portfolio');
  });

  test('classifyTelegramIntent "goal apa" goals', () => {
    const result = classifier.classifyTelegramIntent('goal apa');
    assert.strictEqual(result.intent, 'goals');
    assert.strictEqual(result.command, 'goals');
  });

  test('classifyTelegramIntent "prioritas saya" priorities', () => {
    const result = classifier.classifyTelegramIntent('prioritas saya');
    assert.strictEqual(result.intent, 'priorities');
    assert.strictEqual(result.command, 'priorities');
  });

  test('classifyTelegramIntent "rencana saya" plans', () => {
    const result = classifier.classifyTelegramIntent('rencana saya');
    assert.strictEqual(result.intent, 'plans');
    assert.strictEqual(result.command, 'plans');
  });

  test('classifyTelegramIntent "integrasi status" integrations', () => {
    const result = classifier.classifyTelegramIntent('integrasi status');
    assert.strictEqual(result.intent, 'integrations');
    assert.strictEqual(result.command, 'integrations');
  });

  test('classifyTelegramIntent "backup status" backup', () => {
    const result = classifier.classifyTelegramIntent('backup status');
    assert.strictEqual(result.intent, 'backup');
    assert.strictEqual(result.command, 'backup');
  });

  test('classifyTelegramIntent "briefing" briefing', () => {
    const result = classifier.classifyTelegramIntent('briefing');
    assert.strictEqual(result.intent, 'briefing');
    assert.strictEqual(result.command, 'briefing');
  });

  test('classifyTelegramIntent "laporan portfolio" portfolioreport', () => {
    const result = classifier.classifyTelegramIntent('laporan portfolio');
    assert.strictEqual(result.intent, 'portfolioreport');
    assert.strictEqual(result.command, 'portfolioreport');
  });

  test('classifyTelegramIntent "laporan hidup" lifereport', () => {
    const result = classifier.classifyTelegramIntent('laporan hidup');
    assert.strictEqual(result.intent, 'lifereport');
    assert.strictEqual(result.command, 'lifereport');
  });

  // ── classifyTelegramIntent with secret patterns (blocked) ──

  test('classifyTelegramIntent blocks TELEGRAM_TOKEN', () => {
    const result = classifier.classifyTelegramIntent('TELEGRAM_TOKEN=abc123');
    assert.strictEqual(result.intent, 'contains_secret');
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.confidence, 100);
  });

  test('classifyTelegramIntent blocks GITHUB_TOKEN', () => {
    const result = classifier.classifyTelegramIntent('GITHUB_TOKEN=xyz789');
    assert.strictEqual(result.intent, 'contains_secret');
    assert.strictEqual(result.blocked, true);
  });

  test('classifyTelegramIntent blocks DATABASE_URL', () => {
    const result = classifier.classifyTelegramIntent('DATABASE_URL=postgresql://u:p@h/d');
    assert.strictEqual(result.intent, 'contains_secret');
    assert.strictEqual(result.blocked, true);
  });

  test('classifyTelegramIntent blocks sk- key pattern', () => {
    const result = classifier.classifyTelegramIntent('some text sk-abcdefghijklmnopqrst');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('classifyTelegramIntent blocks ghp_ token', () => {
    const result = classifier.classifyTelegramIntent('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('classifyTelegramIntent blocks postgresql:// url', () => {
    const result = classifier.classifyTelegramIntent('postgresql://user:pass@localhost:5432/db');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('classifyTelegramIntent blocks github_pat_ token', () => {
    const result = classifier.classifyTelegramIntent('github_pat_abc123def456');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  // ── classifyTelegramIntent with empty/invalid input ──

  test('classifyTelegramIntent returns unknown for null', () => {
    const result = classifier.classifyTelegramIntent(null);
    assert.strictEqual(result.intent, 'unknown');
    assert.strictEqual(result.confidence, 0);
  });

  test('classifyTelegramIntent returns unknown for undefined', () => {
    const result = classifier.classifyTelegramIntent(undefined);
    assert.strictEqual(result.intent, 'unknown');
  });

  test('classifyTelegramIntent returns unknown for empty string', () => {
    const result = classifier.classifyTelegramIntent('');
    assert.strictEqual(result.intent, 'unknown');
  });

  test('classifyTelegramIntent returns unknown for non-string', () => {
    const result = classifier.classifyTelegramIntent(42);
    assert.strictEqual(result.intent, 'unknown');
  });

  test('classifyTelegramIntent returns unknown for object', () => {
    const result = classifier.classifyTelegramIntent({});
    assert.strictEqual(result.intent, 'unknown');
  });

  test('classifyTelegramIntent returns unknown for whitespace', () => {
    const result = classifier.classifyTelegramIntent('   ');
    assert.strictEqual(result.intent, 'unknown');
  });

  // ── isSecretMessage ──

  test('isSecretMessage returns true for token pattern', () => {
    assert.strictEqual(classifier.isSecretMessage('TELEGRAM_TOKEN=abc'), true);
  });

  test('isSecretMessage returns true for ghp_ pattern', () => {
    assert.strictEqual(classifier.isSecretMessage('ghp_abcdefghijklmnopqrstuvwxyz1234567890'), true);
  });

  test('isSecretMessage returns false for normal text', () => {
    assert.strictEqual(classifier.isSecretMessage('hello world'), false);
  });

  test('isSecretMessage returns false for null', () => {
    assert.strictEqual(classifier.isSecretMessage(null), false);
  });

  test('isSecretMessage returns false for empty string', () => {
    assert.strictEqual(classifier.isSecretMessage(''), false);
  });

  // ── Module exports ──

  test('module exports INTENT_PATTERNS array', () => {
    assert.ok(Array.isArray(classifier.INTENT_PATTERNS));
    assert.ok(classifier.INTENT_PATTERNS.length > 10);
  });

  test('module exports BLOCKED_PATTERNS array', () => {
    assert.ok(Array.isArray(classifier.BLOCKED_PATTERNS));
    assert.ok(classifier.BLOCKED_PATTERNS.length > 5);
  });

  // ── Additional patterns ──

  test('classifyTelegramIntent "ada kejadian" list_incidents', () => {
    const result = classifier.classifyTelegramIntent('ada kejadian');
    assert.strictEqual(result.intent, 'list_incidents');
  });

  test('classifyTelegramIntent "tampilkan incidents"', () => {
    const result = classifier.classifyTelegramIntent('tampilkan incidents');
    assert.strictEqual(result.intent, 'list_incidents');
  });

  test('classifyTelegramIntent "mengapa render gagal"', () => {
    const result = classifier.classifyTelegramIntent('mengapa render gagal');
    assert.strictEqual(result.intent, 'analyze_deploy_failure');
  });

  test('classifyTelegramIntent confirmation "oke"', () => {
    const result = classifier.classifyTelegramIntent('oke');
    assert.strictEqual(result.intent, 'confirmation');
  });

  test('classifyTelegramIntent rejection "tidak"', () => {
    const result = classifier.classifyTelegramIntent('tidak');
    assert.strictEqual(result.intent, 'rejection');
  });

  test('classifyTelegramIntent "kondisi server" status', () => {
    const result = classifier.classifyTelegramIntent('kondisi server');
    assert.strictEqual(result.intent, 'status');
  });

  test('classifyTelegramIntent "siapa aku" whoami', () => {
    const result = classifier.classifyTelegramIntent('siapa aku');
    assert.strictEqual(result.intent, 'whoami');
  });

  test('classifyTelegramIntent "now fokus" focus', () => {
    const result = classifier.classifyTelegramIntent('sekarang fokus');
    assert.strictEqual(result.intent, 'focus');
  });

  test('classifyTelegramIntent "pengetahuan tentang" knowledge_search', () => {
    const result = classifier.classifyTelegramIntent('pengetahuan tentang AI');
    assert.strictEqual(result.intent, 'knowledge_search');
  });

  test('classifyTelegramIntent "codex harus" tool_recommendation', () => {
    const result = classifier.classifyTelegramIntent('codex harus apa');
    assert.strictEqual(result.intent, 'tool_recommendation');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
