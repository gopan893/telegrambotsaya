'use strict';

const assert = require('assert');
const botRegistry = require('../src/multibot/bot-registry');
const normalizer = require('../src/telegram-control/telegram-update-normalizer');
const syncChecker = require('../src/telegram-control/telegram-message-sync-checker');

function run() {
  const env = {
    TELEGRAM_TOKEN: 'configured-default',
    TELEGRAM_TOKEN_PLANNER: 'configured-planner',
    TELEGRAM_TOKEN_CODER: 'configured-coder',
    TELEGRAM_TOKEN_CRITIC: 'configured-critic',
    TELEGRAM_TOKEN_PLANNE: 'configured-typo'
  };
  botRegistry.loadBotConfigs(env);
  const summary = botRegistry.buildBotStatusSummary(env);

  assert.strictEqual(summary.bots.find(bot => bot.id === 'default').agentId, 'orchestrator');
  assert.strictEqual(summary.bots.find(bot => bot.id === 'planner').tokenConfigured, true);
  assert.strictEqual(summary.bots.find(bot => bot.id === 'coder').tokenConfigured, true);
  assert.strictEqual(summary.bots.find(bot => bot.id === 'critic').tokenConfigured, true);
  assert.match(summary.warnings[0].message, /TELEGRAM_TOKEN_PLANNE/);

  const normalized = normalizer.normalizeTelegramUpdate({
    __botId: 'planner',
    update_id: 1,
    message: {
      message_id: 1,
      text: 'buat roadmap',
      chat: { id: 1, type: 'group' },
      from: { id: 2 }
    }
  });
  assert.strictEqual(normalized.botId, 'planner');

  const report = syncChecker.buildTelegramDiagnostics(normalized, { intent: 'planning' }, {
    botRegistry,
    env,
    webhookRoute: 'multibot'
  });
  const rendered = syncChecker.formatTelegramDiagnostics(report);
  assert.match(rendered, /planner -> planner/);
  assert.doesNotMatch(rendered, /configured-planner/);
  assert.match(rendered, /Possible typo/);

  console.log('PASS test-telegram-multibot-mapping');
}

run();
