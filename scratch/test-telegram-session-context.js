'use strict';

const assert = require('assert');
const contextStore = require('../src/telegram-control/telegram-context-store');

function run() {
  contextStore.clearTelegramContextStore();

  assert.strictEqual(contextStore.saveTelegramSessionContext(1, 2, { latestTopic: 'guru marah' }), true);
  assert.strictEqual(contextStore.updateLatestUserMessage(1, 2, 'Bagaimana menghadapi guru marah?'), true);
  assert.strictEqual(contextStore.updateLatestIntent(1, 2, { intent: 'personal_advice' }), true);

  const session = contextStore.getTelegramSessionContext(1, 2);
  assert.strictEqual(session.latestTopic, 'guru marah');
  assert.strictEqual(session.latestIntent, 'personal_advice');
  assert.match(session.latestUserMessage, /guru marah/i);

  const followup = contextStore.resolveShortFollowupContext({
    chatId: 1,
    userId: 2,
    text: 'Solusinya apa?',
    messageId: 11,
    messageType: 'text'
  });
  assert.strictEqual(followup.isShortFollowup, true);
  assert.strictEqual(followup.resolved, true);
  assert.strictEqual(followup.latestTopic, 'guru marah');

  contextStore.updateLatestUserMessage(1, 2, 'TELEGRAM_TOKEN=123456');
  const redacted = contextStore.getTelegramSessionContext(1, 2);
  assert.strictEqual(redacted.latestUserMessage, '[REDACTED_SECRET_MESSAGE]');
  assert.strictEqual(redacted.secretDetected, true);

  contextStore.clearTelegramContextStore();
  assert.strictEqual(contextStore.getTelegramContextStoreSize(), 0);
  console.log('PASS test-telegram-session-context');
}

run();
