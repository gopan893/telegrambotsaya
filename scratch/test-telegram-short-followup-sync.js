'use strict';

const assert = require('assert');
const dispatcher = require('../src/telegram-control/telegram-runtime-dispatcher');
const contextStore = require('../src/telegram-control/telegram-context-store');

async function run() {
  dispatcher.clearTelegramRuntimeDispatcherState();
  contextStore.clearTelegramContextStore();
  contextStore.saveTelegramSessionContext(55, 66, {
    latestTopic: 'guru marah',
    latestIntent: 'personal_advice',
    latestUserMessage: 'Bagaimana menghadapi guru yang sedang marah besar?'
  });

  const result = await dispatcher.dispatchTelegramUpdate({
    update_id: 201,
    message: {
      message_id: 201,
      text: 'Solusinya apa?',
      chat: { id: 55, type: 'private' },
      from: { id: 66 }
    }
  }, 'default', { safeSendMessage: async () => ({ ok: true }) });

  assert.strictEqual(result.route.intent, 'followup_answer');
  assert.strictEqual(result.followup.isShortFollowup, true);
  assert.strictEqual(result.followup.resolved, true);
  assert.strictEqual(result.followup.latestTopic, 'guru marah');
  assert.match(result.followup.contextText, /guru/i);

  const session = contextStore.getTelegramSessionContext(55, 66);
  assert.strictEqual(session.latestTopic, 'guru marah');
  assert.strictEqual(session.latestIntent, 'followup_answer');

  console.log('PASS test-telegram-short-followup-sync');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
