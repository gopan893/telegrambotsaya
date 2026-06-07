'use strict';

const normalizer = require('./telegram-update-normalizer');
const utils = require('./telegram-utils');

function safeBotMappingStatus(services = {}) {
  try {
    const env = services.env || process.env;
    const summary = services.botRegistry?.buildBotStatusSummary
      ? services.botRegistry.buildBotStatusSummary(env)
      : null;
    if (!summary) {
      return {
        available: false,
        multiBotEnabled: false,
        configured: 0,
        enabled: 0,
        bots: [],
        warnings: []
      };
    }
    return {
      available: true,
      multiBotEnabled: Boolean(summary.multiBotEnabled),
      configured: summary.configured || 0,
      enabled: summary.enabled || 0,
      defaultBotId: summary.defaultBotId || null,
      bots: (summary.bots || []).map(bot => ({
        id: bot.id,
        agentId: bot.agentId,
        tokenConfigured: Boolean(bot.tokenConfigured),
        webhookSecretConfigured: Boolean(bot.webhookSecretConfigured),
        enabled: Boolean(bot.enabled),
        status: bot.status || ''
      })),
      warnings: (summary.warnings || []).map(warning => warning.message || warning.code || String(warning))
    };
  } catch (err) {
    return {
      available: false,
      error: utils.sanitizeText(err.message || 'bot mapping unavailable')
    };
  }
}

function buildPrivacyWarning(normalized = {}) {
  if (!['group', 'supergroup'].includes(normalized.chatType)) return '';
  if (normalized.text) return '';
  return 'Group privacy may be limiting non-command messages, or this update has no text/caption.';
}

function buildTelegramDiagnostics(normalized = {}, routeResult = {}, services = {}) {
  const botMapping = safeBotMappingStatus(services);
  const routerIntent = routeResult.intent || routeResult.route?.intent || routeResult.classification?.intent || null;
  const command = normalized.command || routeResult.commandName || routeResult.command?.name || null;
  return {
    ok: true,
    botId: normalized.botId || 'default',
    chatId: normalized.chatId,
    userId: normalized.userId,
    chatType: normalized.chatType,
    messageId: normalized.messageId,
    messageType: normalized.messageType,
    rawType: normalized.rawType,
    textDetected: Boolean(normalized.text),
    normalizedTextPreview: normalized.text ? utils.truncateText(utils.sanitizeText(normalized.text), 120) : '',
    isCommand: Boolean(normalized.isCommand),
    command,
    routerIntent,
    webhookRoute: services.webhookRoute || normalized.rawType || 'unknown',
    privacyWarning: buildPrivacyWarning(normalized),
    multiBot: botMapping
  };
}

function formatTelegramDiagnostics(report = {}) {
  const bots = report.multiBot?.bots || [];
  const mappingLines = bots.length
    ? bots.slice(0, 12).map(bot => `- ${bot.id} -> ${bot.agentId}: token=${bot.tokenConfigured ? 'set' : 'missing'}, enabled=${bot.enabled ? 'yes' : 'no'}`).join('\n')
    : '- unavailable';
  const warnings = [
    report.privacyWarning,
    ...(report.multiBot?.warnings || [])
  ].filter(Boolean);

  return [
    'Telegram Runtime Check',
    `Bot ID: ${report.botId || '-'}`,
    `Chat ID: ${report.chatId || '-'}`,
    `User ID: ${report.userId || '-'}`,
    `Chat type: ${report.chatType || '-'}`,
    `Message type: ${report.messageType || '-'} (${report.rawType || '-'})`,
    `Text detected: ${report.textDetected ? 'yes' : 'no'}`,
    `Text preview: ${report.normalizedTextPreview || '-'}`,
    `Command: ${report.command ? '/' + report.command : '-'}`,
    `Router intent: ${report.routerIntent || '-'}`,
    `Webhook route: ${report.webhookRoute || '-'}`,
    '',
    'Multi-bot mapping:',
    mappingLines,
    warnings.length ? `\nWarnings:\n${warnings.map(item => `- ${utils.sanitizeText(item)}`).join('\n')}` : ''
  ].filter(line => line !== '').join('\n');
}

function buildTelegramMessageSyncReport(normalized = {}, routeResult = {}, services = {}) {
  return buildTelegramDiagnostics(normalized, routeResult, services);
}

function checkTelegramMessageSync(update = {}, services = {}) {
  const normalized = update?.chatId !== undefined
    ? update
    : normalizer.normalizeTelegramUpdate(update, services);
  let routeResult = {};
  try {
    routeResult = services.naturalRouter?.routeTelegramNaturalMessage
      ? services.naturalRouter.routeTelegramNaturalMessage({ message: { text: normalized.text, chat: { id: normalized.chatId }, from: { id: normalized.userId } } }, {})
      : {};
  } catch (err) {
    routeResult = { intent: 'route_check_failed', reason: utils.sanitizeText(err.message || '') };
  }
  return buildTelegramMessageSyncReport(normalized, routeResult, services);
}

module.exports = {
  buildTelegramDiagnostics,
  buildTelegramMessageSyncReport,
  checkTelegramMessageSync,
  formatTelegramDiagnostics,
  safeBotMappingStatus
};
