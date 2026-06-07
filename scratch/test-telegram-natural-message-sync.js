'use strict';

const assert = require('assert');
const dispatcher = require('../src/telegram-control/telegram-runtime-dispatcher');
const contextStore = require('../src/telegram-control/telegram-context-store');

async function run() {
  dispatcher.clearTelegramRuntimeDispatcherState();
  contextStore.clearTelegramContextStore();

  const result = await dispatcher.dispatchTelegramUpdate({
    update_id: 101,
    message: {
      message_id: 101,
      text: 'deploy ke Render',
      chat: { id: -100, type: 'supergroup' },
      from: { id: 7, username: 'owner' }
    }
  }, 'default', { safeSendMessage: async () => ({ ok: true }) });

  assert.strictEqual(result.type, 'natural');
  assert.strictEqual(result.passThrough, true);
  assert.strictEqual(result.route.intent, 'propose_deploy');
  assert.strictEqual(result.route.commandName, 'propose_deploy');

  const session = contextStore.getTelegramSessionContext(-100, 7);
  assert.strictEqual(session.latestIntent, 'propose_deploy');
  assert.strictEqual(session.latestTopic, 'propose_deploy');
  assert.match(session.latestUserMessage, /deploy ke Render/);

  console.log('PASS test-telegram-natural-message-sync');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
