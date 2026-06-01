'use strict';

const assert = require('assert');
const multibot = require('../src/multibot');

const env = {
  TELEGRAM_TOKEN: 'legacy-token',
  TELEGRAM_TOKEN_ORCHESTRATOR: 'orch-token',
  TELEGRAM_TOKEN_CODER: 'coder-token',
  TELEGRAM_USERNAME_CODER: 'coder_bot',
  TELEGRAM_WEBHOOK_SECRET_CODER: 'coder-secret'
};

const configs = multibot.botRegistry.loadBotConfigs(env);
assert.ok(configs.some(config => config.id === 'default' && config.agentId === 'orchestrator'));
assert.ok(configs.some(config => config.id === 'coder' && config.tokenConfigured));
assert.ok(configs.some(config => config.id === 'planner' && !config.tokenConfigured));

const safe = multibot.botRegistry.listBotConfigsSafe(env);
assert.ok(!JSON.stringify(safe).includes('legacy-token'));
assert.ok(!JSON.stringify(safe).includes('coder-secret'));
assert.equal(safe.find(bot => bot.id === 'coder').webhookSecretConfigured, true);

assert.equal(multibot.botRegistry.resolveBotByWebhook('missing', '', env).status, 404);
assert.equal(multibot.botRegistry.resolveBotByWebhook('coder', 'wrong', env).status, 403);
assert.equal(multibot.botRegistry.resolveBotByWebhook('coder', 'coder-secret', env).ok, true);

const noLegacyEnv = {
  TELEGRAM_TOKEN_ORCHESTRATOR: 'orch-token-only'
};
multibot.botRegistry.loadBotConfigs(noLegacyEnv);
assert.equal(multibot.botRegistry.getDefaultBot(noLegacyEnv).id, 'orchestrator');

console.log('test-multibot-config: ok');
