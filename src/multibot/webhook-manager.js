'use strict';

const botRegistry = require('./bot-registry');

function validateWebhookSecret(botConfig, req) {
  const supplied = req.params?.secret || req.headers['x-telegram-bot-api-secret-token'] || '';
  if (!botConfig?.webhookSecretConfigured) return true;
  return String(supplied || '') === botConfig.webhookSecret;
}

function normalizeIncomingUpdate(update = {}, botConfig = {}) {
  const normalized = { ...(update || {}) };
  normalized.__botId = botConfig.id || 'default';
  normalized.__agentId = botConfig.agentId || 'orchestrator';
  normalized.__botUsername = botConfig.username || '';
  normalized.__source = 'multibot';
  if (normalized.message) {
    normalized.message.__botId = normalized.__botId;
    normalized.message.__agentId = normalized.__agentId;
    normalized.message.__botUsername = normalized.__botUsername;
    normalized.message.__source = normalized.__source;
  }
  if (normalized.callback_query) {
    normalized.callback_query.__botId = normalized.__botId;
    normalized.callback_query.__agentId = normalized.__agentId;
    normalized.callback_query.__botUsername = normalized.__botUsername;
    normalized.callback_query.__source = normalized.__source;
  }
  return normalized;
}

async function dispatchUpdateToMainHandler(normalizedUpdate, services = {}) {
  if (typeof services.handleTelegramUpdate === 'function') {
    return services.handleTelegramUpdate(normalizedUpdate);
  }
  if (typeof services.dispatchTelegramUpdate === 'function') {
    return services.dispatchTelegramUpdate(normalizedUpdate);
  }
  return { ok: false, reason: 'NO_UPDATE_HANDLER' };
}

async function auditWebhook(action, req, extra = {}, services = {}) {
  try {
    await services.auditLog?.recordAuditLog?.({
      actorType: 'telegram',
      actorId: extra.botId || req.params?.botId || 'unknown',
      action,
      targetType: 'multibot_webhook',
      targetId: extra.botId || req.params?.botId || 'unknown',
      status: extra.status || 'ok',
      decision: extra.decision || 'allowed',
      reason: extra.reason || '',
      afterSummary: {
        botId: extra.botId || req.params?.botId || '',
        source: 'multibot',
        status: extra.status || 'ok'
      }
    }, services);
  } catch (_) {}
}

async function handleBotWebhook(botId, req, res, services = {}) {
  const env = services.env || process.env;
  const resolved = botRegistry.resolveBotByWebhook(botId, req.params?.secret || req.headers['x-telegram-bot-api-secret-token'] || '', env);
  if (!resolved.ok) {
    await auditWebhook(resolved.reason === 'INVALID_WEBHOOK_SECRET' ? 'multibot/webhook_invalid_secret' : 'multibot/webhook_unknown_bot', req, {
      botId,
      status: 'denied',
      decision: 'denied',
      reason: resolved.reason
    }, services);
    return res.sendStatus(resolved.status || 404);
  }
  if (!validateWebhookSecret(resolved.bot, req)) {
    await auditWebhook('multibot/webhook_invalid_secret', req, {
      botId,
      status: 'denied',
      decision: 'denied',
      reason: 'INVALID_WEBHOOK_SECRET'
    }, services);
    return res.sendStatus(403);
  }
  try {
    const update = normalizeIncomingUpdate(req.body, resolved.bot);
    await dispatchUpdateToMainHandler(update, services);
    return res.sendStatus(200);
  } catch (err) {
    services.logger?.warn?.('multibot webhook dispatch failed', { botId, error: err.message });
    return res.sendStatus(200);
  }
}

function registerMultiBotWebhookRoutes(app, services = {}) {
  if (!app || typeof app.post !== 'function') return null;
  app.post('/webhook/bot/:botId', (req, res) => handleBotWebhook(req.params.botId, req, res, services));
  app.post('/webhook/bot/:botId/:secret', (req, res) => handleBotWebhook(req.params.botId, req, res, services));
  return true;
}

module.exports = {
  dispatchUpdateToMainHandler,
  handleBotWebhook,
  normalizeIncomingUpdate,
  registerMultiBotWebhookRoutes,
  validateWebhookSecret
};
