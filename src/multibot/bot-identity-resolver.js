'use strict';

const botRegistry = require('./bot-registry');
const { sanitizeBotConfig } = require('./bot-config');

function resolveUpdateBotIdentity(update = {}, services = {}) {
  const env = services.env || process.env;
  const explicitBotId = update.__botId || update.message?.__botId || update.callback_query?.__botId || 'default';
  const config = botRegistry.getBotConfig(explicitBotId, env) || botRegistry.getDefaultBot(env);
  return {
    botId: config?.id || 'default',
    agentId: update.__agentId || config?.agentId || 'orchestrator',
    botUsername: update.__botUsername || config?.username || '',
    source: update.__source || (explicitBotId === 'default' ? 'legacy' : 'multibot'),
    bot: config ? sanitizeBotConfig(config) : null
  };
}

function attachBotIdentityToMessage(msg = {}, identity = {}) {
  if (!msg || typeof msg !== 'object') return msg;
  msg.__botId = identity.botId || 'default';
  msg.__agentId = identity.agentId || 'orchestrator';
  msg.__botUsername = identity.botUsername || '';
  msg.__source = identity.source || 'legacy';
  return msg;
}

module.exports = {
  attachBotIdentityToMessage,
  resolveUpdateBotIdentity
};
