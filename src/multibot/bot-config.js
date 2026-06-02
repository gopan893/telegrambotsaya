'use strict';

const { hasValue, isTruthy, normalizeId, toEnvSuffix } = require('./multibot-utils');

const BOT_ROLES = [
  'orchestrator',
  'planner',
  'coder',
  'critic',
  'research',
  'ops',
  'security',
  'memory',
  'executor',
  'reflection'
];

const ROLE_LABELS = {
  orchestrator: 'Orchestrator',
  planner: 'Planner',
  coder: 'Coder',
  critic: 'Critic',
  research: 'Research',
  ops: 'Ops',
  security: 'Security',
  memory: 'Memory',
  executor: 'Executor',
  reflection: 'Reflection'
};

function buildWebhookPath(id) {
  return `/webhook/bot/${encodeURIComponent(id)}`;
}

function createBotConfig({
  id,
  token,
  username,
  agentId,
  role,
  webhookSecret,
  createdFrom = 'env',
  enabled
}) {
  const cleanId = normalizeId(id);
  const tokenConfigured = hasValue(token);
  const secretConfigured = hasValue(webhookSecret);
  return {
    id: cleanId,
    username: String(username || '').trim(),
    tokenConfigured,
    token: tokenConfigured ? String(token).trim() : '',
    agentId: normalizeId(agentId || role || cleanId || 'orchestrator'),
    enabled: enabled === undefined ? tokenConfigured : Boolean(enabled && tokenConfigured),
    webhookPath: buildWebhookPath(cleanId),
    webhookSecretConfigured: secretConfigured,
    webhookSecret: secretConfigured ? String(webhookSecret).trim() : '',
    role: role || cleanId,
    displayName: ROLE_LABELS[role] || ROLE_LABELS[cleanId] || cleanId,
    createdFrom,
    status: tokenConfigured ? 'configured' : 'missing_token'
  };
}

function loadRoleBotConfig(role, env = process.env) {
  const suffix = toEnvSuffix(role);
  return createBotConfig({
    id: role,
    role,
    agentId: role,
    token: env[`TELEGRAM_TOKEN_${suffix}`],
    username: env[`TELEGRAM_USERNAME_${suffix}`],
    webhookSecret: env[`TELEGRAM_WEBHOOK_SECRET_${suffix}`],
    enabled: !isTruthy(env[`TELEGRAM_BOT_${suffix}_DISABLED`]),
    createdFrom: 'env'
  });
}

function loadLegacyBotConfig(env = process.env) {
  return createBotConfig({
    id: 'default',
    role: 'orchestrator',
    agentId: 'orchestrator',
    token: env.TELEGRAM_TOKEN,
    username: env.TELEGRAM_USERNAME || env.TELEGRAM_USERNAME_ORCHESTRATOR,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET_ORCHESTRATOR,
    createdFrom: 'legacy'
  });
}

function loadBotConfigsFromEnv(env = process.env) {
  const configs = [];
  const legacy = loadLegacyBotConfig(env);
  if (legacy.tokenConfigured) configs.push(legacy);

  for (const role of BOT_ROLES) {
    const config = loadRoleBotConfig(role, env);
    configs.push(config);
  }

  const seen = new Set();
  return configs.filter(config => {
    if (!config?.id || seen.has(config.id)) return false;
    seen.add(config.id);
    return true;
  });
}

function detectConfigWarnings(env = process.env) {
  const warnings = [];
  if (hasValue(env.TELEGRAM_TOKEN_PLANNE)) {
    warnings.push({
      code: 'POSSIBLE_TELEGRAM_TOKEN_PLANNER_TYPO',
      message: 'Possible typo: TELEGRAM_TOKEN_PLANNE detected. Use TELEGRAM_TOKEN_PLANNER.'
    });
  }
  return warnings;
}

function sanitizeBotConfig(config = {}) {
  return {
    id: config.id,
    username: config.username || '',
    tokenConfigured: Boolean(config.tokenConfigured),
    agentId: config.agentId,
    enabled: Boolean(config.enabled),
    webhookPath: config.webhookPath,
    webhookSecretConfigured: Boolean(config.webhookSecretConfigured),
    role: config.role,
    displayName: config.displayName || config.role || config.id,
    createdFrom: config.createdFrom || 'env',
    status: config.status || (config.tokenConfigured ? 'configured' : 'missing_token')
  };
}

function validateBotConfig(config = {}) {
  const errors = [];
  if (!normalizeId(config.id)) errors.push('BOT_ID_REQUIRED');
  if (!normalizeId(config.agentId)) errors.push('AGENT_ID_REQUIRED');
  if (config.enabled && !config.tokenConfigured) errors.push('ENABLED_BOT_REQUIRES_TOKEN');
  return {
    ok: errors.length === 0,
    errors
  };
}

module.exports = {
  BOT_ROLES,
  ROLE_LABELS,
  buildWebhookPath,
  createBotConfig,
  detectConfigWarnings,
  loadBotConfigsFromEnv,
  loadLegacyBotConfig,
  loadRoleBotConfig,
  sanitizeBotConfig,
  validateBotConfig
};
