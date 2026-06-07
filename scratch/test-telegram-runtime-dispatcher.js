'use strict';

const assert = require('assert');
const dispatcher = require('../src/telegram-control/telegram-runtime-dispatcher');
const contextStore = require('../src/telegram-control/telegram-context-store');

async function run() {
  dispatcher.clearTelegramRuntimeDispatcherState();
  contextStore.clearTelegramContextStore();
  const sent = [];
  const services = {
    safeSendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
      return { ok: true };
    },
    botRegistry: {
      buildBotStatusSummary: () => ({
        multiBotEnabled: true,
        configured: 2,
        enabled: 2,
        defaultBotId: 'default',
        bots: [
          { id: 'default', agentId: 'orchestrator', tokenConfigured: true, enabled: true },
          { id: 'planner', agentId: 'planner', tokenConfigured: true, enabled: true }
        ],
        warnings: []
      })
    },
    webhookRoute: '/webhook'
  };

  const diag = await dispatcher.dispatchTelegramUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      text: '/telegramcheck',
      chat: { id: 10, type: 'private' },
      from: { id: 20 }
    }
  }, 'default', services);
  assert.strictEqual(diag.handled, true);
  assert.match(sent[0].text, /Telegram Runtime Check/);
  assert.doesNotMatch(sent[0].text, /[0-9]{6,}:[A-Za-z0-9_-]{20,}/);

  const natural = await dispatcher.dispatchTelegramUpdate({
    update_id: 2,
    message: {
      message_id: 2,
      text: 'buat rencana hari ini',
      chat: { id: 10, type: 'private' },
      from: { id: 20 }
    }
  }, 'default', services);
  assert.strictEqual(natural.passThrough, true);
  assert.strictEqual(natural.route.intent, 'daily_plan');
  assert.strictEqual(contextStore.getTelegramSessionContext(10, 20).latestIntent, 'daily_plan');

  const blocked = await dispatcher.dispatchTelegramUpdate({
    update_id: 3,
    message: {
      message_id: 3,
      text: 'TELEGRAM_TOKEN=123456',
      chat: { id: 10, type: 'private' },
      from: { id: 20 }
    }
  }, 'default', services);
  assert.strictEqual(blocked.handled, true);
  assert.strictEqual(blocked.blocked, true);
  assert.match(sent.at(-1).text, /rahasia/i);

  console.log('PASS test-telegram-runtime-dispatcher');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
