'use strict';

const assert = require('assert');
const path = require('path');
const router = require('../src/telegram-control/telegram-natural-router');

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

function makeMessage(text, opts) {
  return {
    message: {
      text: text || '',
      from: { id: opts?.userId || 12345, is_bot: false },
      chat: { id: opts?.chatId || 67890 },
      message_id: opts?.messageId || 1
    }
  };
}

function makeBotMessage(text) {
  return {
    message: {
      text: text || 'bot response',
      from: { id: 999, is_bot: true },
      chat: { id: 67890 },
      message_id: 2
    }
  };
}

function run() {
  console.log('=== test-telegram-natural-router.js ===\n');

  // ── routeTelegramNaturalMessage with valid slash command ──

  test('routeTelegramNaturalMessage routes /start', () => {
    const msg = makeMessage('/start');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'slash_command');
    assert.ok(result.command);
    assert.strictEqual(result.command.name, 'start');
  });

  test('routeTelegramNaturalMessage routes /help', () => {
    const msg = makeMessage('/help');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'slash_command');
    assert.ok(result.command);
    assert.strictEqual(result.command.name, 'help');
  });

  test('routeTelegramNaturalMessage routes unknown /command', () => {
    const msg = makeMessage('/someunknowncommand123');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'slash_command');
    assert.strictEqual(result.command, null);
    assert.ok(result.response.includes('tidak dikenali'));
  });

  // ── routeTelegramNaturalMessage with natural language ──

  test('routeTelegramNaturalMessage natural "cek production health"', () => {
    const msg = makeMessage('cek production health');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.ok(result.intent);
    assert.ok(result.chatId);
  });

  test('routeTelegramNaturalMessage natural "ada incident"', () => {
    const msg = makeMessage('ada incident');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.ok(result.intent);
  });

  test('routeTelegramNaturalMessage natural "kenapa deploy gagal"', () => {
    const msg = makeMessage('kenapa deploy gagal');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.ok(result.intent);
  });

  test('routeTelegramNaturalMessage natural "buat rencana hari ini"', () => {
    const msg = makeMessage('buat rencana hari ini');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
  });

  test('routeTelegramNaturalMessage natural "push perubahan ini ke github"', () => {
    const msg = makeMessage('push perubahan ini ke github');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
  });

  test('routeTelegramNaturalMessage natural "deploy ke render"', () => {
    const msg = makeMessage('deploy ke render');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
  });

  test('routeTelegramNaturalMessage natural "rollback deploy terakhir"', () => {
    const msg = makeMessage('rollback deploy terakhir');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
  });

  // ── routeTelegramNaturalMessage with secret-containing message ──

  test('routeTelegramNaturalMessage blocks token secret', () => {
    const msg = makeMessage('TELEGRAM_TOKEN=abc123');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('routeTelegramNaturalMessage blocks database url', () => {
    const msg = makeMessage('postgresql://user:pass@host/db');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
  });

  test('routeTelegramNaturalMessage blocks ghp_token', () => {
    const msg = makeMessage('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
  });

  // ── routeTelegramNaturalMessage with greeting ──

  test('routeTelegramNaturalMessage greeting "halo"', () => {
    const msg = makeMessage('halo');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'greeting');
    assert.ok(result.response);
  });

  test('routeTelegramNaturalMessage greeting "pagi"', () => {
    const msg = makeMessage('pagi');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'greeting');
  });

  test('routeTelegramNaturalMessage greeting "hello"', () => {
    const msg = makeMessage('hello');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'greeting');
  });

  // ── routeTelegramNaturalMessage with thanks ──

  test('routeTelegramNaturalMessage thanks "terima kasih"', () => {
    const msg = makeMessage('terima kasih');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'thanks');
  });

  test('routeTelegramNaturalMessage thanks "thanks"', () => {
    const msg = makeMessage('thanks');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'thanks');
  });

  // ── routeTelegramNaturalMessage with unknown message ──

  test('routeTelegramNaturalMessage unknown message', () => {
    const msg = makeMessage('!@#$%^&*()_+ some random gibberish xyzzy');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.intent, 'unknown');
    assert.ok(result.response);
  });

  test('routeTelegramNaturalMessage null message', () => {
    const result = router.routeTelegramNaturalMessage(null);
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.intent, 'unknown');
  });

  // ── routeTelegramNaturalMessage with bot message ──

  test('routeTelegramNaturalMessage bot message not handled', () => {
    const msg = makeBotMessage('some bot text');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.intent, 'bot_message');
    assert.strictEqual(result.response, null);
  });

  // ── handleShortFollowup ──

  test('handleShortFollowup returns topic when context has latestTopic', () => {
    const msg = makeMessage('ya');
    const context = { latestTopic: 'deploy', chatId: 67890 };
    const result = router.handleShortFollowup(msg, context);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.topic, 'deploy');
  });

  test('handleShortFollowup returns not handled without context', () => {
    const msg = makeMessage('ya');
    const result = router.handleShortFollowup(msg, null);
    assert.strictEqual(result.handled, false);
  });

  test('handleShortFollowup returns not handled without latestTopic', () => {
    const msg = makeMessage('ya');
    const context = {};
    const result = router.handleShortFollowup(msg, context);
    assert.strictEqual(result.handled, false);
  });

  // ── buildNaturalActionPlan ──

  test('buildNaturalActionPlan returns null for null', () => {
    assert.strictEqual(router.buildNaturalActionPlan(null), null);
  });

  test('buildNaturalActionPlan builds plan from result', () => {
    const msg = makeMessage('/health');
    const result = router.routeTelegramNaturalMessage(msg);
    const plan = router.buildNaturalActionPlan(result);
    assert.ok(plan);
    assert.ok(plan.intent);
    assert.ok(plan.action);
    assert.ok(plan.riskLevel);
    assert.ok(plan.args);
    assert.ok(plan.chatId);
  });

  test('buildNaturalActionPlan includes userId if present', () => {
    const msg = makeMessage('/start', { userId: 42 });
    const result = router.routeTelegramNaturalMessage(msg);
    result.userId = 42;
    const plan = router.buildNaturalActionPlan(result);
    assert.strictEqual(plan.userId, 42);
  });

  // ── classifyTelegramIntent passthrough ──

  test('classifyTelegramIntent maps slash command', () => {
    const result = router.classifyTelegramIntent('/deploy', {});
    assert.strictEqual(result.intent, 'slash_command');
    assert.strictEqual(result.command, 'deploy');
  });

  test('classifyTelegramIntent maps natural', () => {
    const result = router.classifyTelegramIntent('cek production health', {});
    assert.strictEqual(result.intent, 'prod_health');
  });

  // ── mapIntentToCommand ──

  test('mapIntentToCommand returns null for null', () => {
    assert.strictEqual(router.mapIntentToCommand(null), null);
  });

  test('mapIntentToCommand maps intent with command', () => {
    const result = router.classifyTelegramIntent('cek production health', {});
    const cmd = router.mapIntentToCommand(result);
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'prodhealth');
  });

  test('mapIntentToCommand maps via intent string', () => {
    const cmd = router.mapIntentToCommand({ intent: 'help', command: 'help' });
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'help');
  });

  // ── refuse_full_auto ──

  test('routeTelegramNaturalMessage refuses full auto', () => {
    const msg = makeMessage('selesaikan semua otomatis');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'refuse_full_auto');
    assert.ok(result.response);
  });

  test('routeTelegramNaturalMessage refuses "otomatiskan semua"', () => {
    const msg = makeMessage('otomatiskan semua');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.intent, 'refuse_full_auto');
  });

  // ── followup_answer ──

  test('routeTelegramNaturalMessage detects followup', () => {
    const msg = makeMessage('solusinya apa');
    const result = router.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.intent, 'followup_answer');
    assert.strictEqual(result.isFollowup, true);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
