'use strict';

const assert = require('assert');
const multibot = require('../src/multibot');

const env = {
  TELEGRAM_TOKEN: 'legacy-token',
  TELEGRAM_TOKEN_ORCHESTRATOR: 'orch-token',
  TELEGRAM_TOKEN_PLANNER: 'planner-token',
  TELEGRAM_TOKEN_CODER: 'coder-token',
  TELEGRAM_TOKEN_CRITIC: 'critic-token',
  TELEGRAM_USERNAME_CODER: 'coder_bot',
  TELEGRAM_WEBHOOK_SECRET_CODER: 'coder-secret',
  TELEGRAM_TOKEN_PLANNE: 'typo-token'
};

const configs = multibot.botRegistry.loadBotConfigs(env);
assert.ok(configs.some(config => config.id === 'default' && config.agentId === 'orchestrator'));
assert.ok(configs.some(config => config.id === 'coder' && config.tokenConfigured));
assert.ok(configs.some(config => config.id === 'planner' && config.tokenConfigured));
assert.ok(configs.some(config => config.id === 'critic' && config.tokenConfigured));

const safe = multibot.botRegistry.listBotConfigsSafe(env);
assert.ok(!JSON.stringify(safe).includes('legacy-token'));
assert.ok(!JSON.stringify(safe).includes('coder-secret'));
assert.equal(safe.find(bot => bot.id === 'coder').webhookSecretConfigured, true);

assert.equal(multibot.botRegistry.resolveBotByWebhook('missing', '', env).status, 404);
assert.equal(multibot.botRegistry.resolveBotByWebhook('coder', 'wrong', env).status, 403);
assert.equal(multibot.botRegistry.resolveBotByWebhook('coder', 'coder-secret', env).ok, true);
assert.ok(multibot.botRegistry.detectConfigWarnings(env).some(item => item.code === 'POSSIBLE_TELEGRAM_TOKEN_PLANNER_TYPO'));

const noLegacyEnv = {
  TELEGRAM_TOKEN_ORCHESTRATOR: 'orch-token-only'
};
multibot.botRegistry.loadBotConfigs(noLegacyEnv);
assert.equal(multibot.botRegistry.getDefaultBot(noLegacyEnv).id, 'orchestrator');

console.log('test-multibot-config: ok');
