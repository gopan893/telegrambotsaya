'use strict';

const {
  detectConfigWarnings,
  loadBotConfigsFromEnv,
  sanitizeBotConfig,
  validateBotConfig
} = require('./bot-config');
const { normalizeId } = require('./multibot-utils');

let registry = {
  loadedAt: null,
  configs: [],
  byId: new Map()
};

function loadBotConfigs(env = process.env) {
  const configs = loadBotConfigsFromEnv(env);
  registry = {
    loadedAt: new Date().toISOString(),
    configs,
    byId: new Map(configs.map(config => [config.id, config]))
  };
  return configs;
}

function ensureLoaded(env = process.env) {
  if (!registry.loadedAt) loadBotConfigs(env);
  return registry;
}

function getBotConfig(botId = '', env = process.env) {
  const current = ensureLoaded(env);
  const cleanId = normalizeId(botId || 'default');
  return current.byId.get(cleanId) || null;
}

function listBotConfigsSafe(env = process.env) {
  return ensureLoaded(env).configs.map(sanitizeBotConfig);
}

function getDefaultBot(env = process.env) {
  const current = ensureLoaded(env);
  return current.byId.get('default')
    || current.byId.get('orchestrator')
    || current.configs.find(config => config.enabled && config.tokenConfigured)
    || current.configs[0]
    || null;
}

function isMultiBotEnabled(env = process.env) {
  const current = ensureLoaded(env);
  return current.configs.filter(config => config.enabled && config.tokenConfigured).length > 1
    || Boolean(current.byId.get('orchestrator')?.enabled);
}

function resolveBotByWebhook(botId, secret, env = process.env) {
  const config = getBotConfig(botId, env);
  if (!config || !config.tokenConfigured) {
    return { ok: false, status: 404, reason: 'UNKNOWN_BOT' };
  }
  if (!config.enabled) {
    return { ok: false, status: 404, reason: 'BOT_DISABLED' };
  }
  if (config.webhookSecretConfigured && String(secret || '') !== config.webhookSecret) {
    return { ok: false, status: 403, reason: 'INVALID_WEBHOOK_SECRET' };
  }
  return { ok: true, bot: config };
}

function buildBotStatusSummary(env = process.env) {
  const current = ensureLoaded(env);
  const enabled = current.configs.filter(config => config.enabled && config.tokenConfigured);
  const configured = current.configs.filter(config => config.tokenConfigured);
  return {
    loadedAt: current.loadedAt,
    multiBotEnabled: isMultiBotEnabled(env),
    total: current.configs.length,
    configured: configured.length,
    enabled: enabled.length,
    defaultBotId: getDefaultBot(env)?.id || null,
    bots: current.configs.map(sanitizeBotConfig),
    warnings: detectConfigWarnings(env)
  };
}

module.exports = {
  buildBotStatusSummary,
  detectConfigWarnings,
  getBotConfig,
  getDefaultBot,
  isMultiBotEnabled,
  listBotConfigsSafe,
  loadBotConfigs,
  resolveBotByWebhook,
  validateBotConfig
};
