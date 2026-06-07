'use strict';

const assert = require('assert');
const dispatcher = require('../src/telegram-control/telegram-runtime-dispatcher');

async function run() {
  dispatcher.clearTelegramRuntimeDispatcherState();

  const botMessage = await dispatcher.dispatchTelegramUpdate({
    update_id: 301,
    message: {
      message_id: 301,
      text: 'bot reply',
      chat: { id: 1, type: 'group' },
      from: { id: 99, is_bot: true }
    }
  }, 'default', {});
  assert.strictEqual(botMessage.ignored, true);
  assert.strictEqual(botMessage.reason, 'BOT_MESSAGE');

  const update = {
    update_id: 302,
    message: {
      message_id: 302,
      text: 'halo',
      chat: { id: 1, type: 'private' },
      from: { id: 2, is_bot: false }
    }
  };
  const first = await dispatcher.dispatchTelegramUpdate(update, 'default', {});
  const second = await dispatcher.dispatchTelegramUpdate(update, 'default', {});
  assert.strictEqual(first.passThrough, true);
  assert.strictEqual(second.duplicate, true);
  assert.strictEqual(second.ignored, true);

  console.log('PASS test-telegram-bot-loop-prevention');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
