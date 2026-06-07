'use strict';

const normalizer = require('./telegram-update-normalizer');
const contextStore = require('./telegram-context-store');
const syncChecker = require('./telegram-message-sync-checker');
const naturalRouter = require('./telegram-natural-router');
const commandRegistry = require('./telegram-command-registry');
const commandAudit = require('./telegram-command-audit');
const responseFormatter = require('./telegram-response-formatter');
const utils = require('./telegram-utils');

const processedMessageKeys = new Map();
const DUPLICATE_TTL_MS = 5 * 60 * 1000;
const DIAGNOSTIC_COMMANDS = new Set(['telegramcheck', 'webhookcheck', 'messagecheck']);

function cleanupProcessed(now = Date.now()) {
  for (const [key, ts] of processedMessageKeys.entries()) {
    if (now - ts > DUPLICATE_TTL_MS) processedMessageKeys.delete(key);
  }
}

function getMessageFingerprint(normalized = {}) {
  return [
    normalized.botId || 'default',
    normalized.chatId || 'nochat',
    normalized.messageId || normalized.updateId || normalized.callbackQueryId || 'nomsg',
    normalized.rawType || 'unknown'
  ].join(':');
}

function rememberMessage(normalized = {}) {
  cleanupProcessed();
  const key = getMessageFingerprint(normalized);
  if (processedMessageKeys.has(key)) return false;
  processedMessageKeys.set(key, Date.now());
  return true;
}

function clearTelegramRuntimeDispatcherState() {
  processedMessageKeys.clear();
}

function recordRuntimeAudit(event = {}, services = {}) {
  const payload = {
    command: event.command || null,
    intent: event.intent || null,
    module: 'telegram_runtime',
    riskLevel: event.riskLevel || 'read_only',
    userId: event.userId || null,
    chatId: event.chatId || null,
    allowed: event.allowed !== false,
    resultStatus: event.resultStatus || event.action || 'routed',
    reason: event.reason || ''
  };
  try {
    commandAudit.recordTelegramCommandAudit(payload);
  } catch (_) {}
  try {
    const auditResult = services.auditLog?.recordAuditLog?.({
      actorType: 'telegram',
      actorId: String(event.userId || 'unknown'),
      action: `telegram/${event.action || 'runtime_event'}`,
      targetType: 'telegram_message',
      targetId: String(event.messageId || event.updateId || ''),
      status: event.allowed === false ? 'denied' : 'ok',
      decision: event.allowed === false ? 'denied' : 'allowed',
      afterSummary: {
        botId: event.botId || 'default',
        chatId: event.chatId || null,
        intent: event.intent || null,
        command: event.command || null,
        reason: utils.sanitizeText(event.reason || '')
      }
    }, services);
    if (auditResult && typeof auditResult.catch === 'function') auditResult.catch(() => {});
  } catch (_) {}
}

async function sendTelegramText(normalized = {}, text = '', services = {}) {
  const finalText = responseFormatter.sanitizeTelegramResponse(text || '');
  const options = {
    reply_to_message_id: normalized.messageId || undefined,
    userText: normalized.text || '',
    hasAttachment: normalized.hasAttachment
  };
  if (typeof services.sendMessageAsBot === 'function') {
    return services.sendMessageAsBot(normalized.botId || 'default', normalized.chatId, finalText, options, services);
  }
  if (services.telegramClient?.sendMessageAsBot) {
    return services.telegramClient.sendMessageAsBot(normalized.botId || 'default', normalized.chatId, finalText, options, services);
  }
  if (typeof services.safeSendMessage === 'function') {
    return services.safeSendMessage(normalized.chatId, finalText, options);
  }
  if (typeof services.sendChunkedMessage === 'function') {
    return services.sendChunkedMessage(normalized.chatId, finalText, options);
  }
  return { ok: false, reason: 'NO_TELEGRAM_SEND_SERVICE', text: finalText };
}

function buildUpdateForNaturalRouter(normalized = {}) {
  return {
    message: {
      text: normalized.text || '',
      caption: normalized.text || '',
      message_id: normalized.messageId || undefined,
      chat: {
        id: normalized.chatId,
        type: normalized.chatType
      },
      from: {
        id: normalized.userId,
        username: normalized.username,
        is_bot: normalized.isBotMessage
      },
      reply_to_message: normalized.reply?.replyToMessageId ? {
        message_id: normalized.reply.replyToMessageId,
        text: normalized.reply.replyText,
        from: {
          id: normalized.reply.replyFromUserId,
          is_bot: normalized.reply.replyFromBot
        }
      } : undefined
    }
  };
}

function normalizeInput(update, botId, services = {}) {
  if (update?.chatId !== undefined && update?.messageType) return update;
  const source = update && typeof update === 'object' ? update : {};
  if (botId && !source.__botId) source.__botId = botId;
  return normalizer.normalizeTelegramUpdate(source, { ...services, botId });
}

async function handleTelegramCommand(normalized = {}, services = {}) {
  const commandName = normalized.command || '';
  if (DIAGNOSTIC_COMMANDS.has(commandName)) {
    const report = syncChecker.buildTelegramDiagnostics(normalized, {
      intent: 'diagnostic',
      commandName
    }, services);
    await sendTelegramText(normalized, syncChecker.formatTelegramDiagnostics(report), services);
    recordRuntimeAudit({
      ...normalized,
      action: 'diagnostic_command',
      command: commandName,
      intent: 'diagnostic'
    }, services);
    return {
      ok: true,
      handled: true,
      passThrough: false,
      type: 'diagnostic_command',
      normalized,
      report
    };
  }

  const cmd = commandRegistry.getTelegramCommand(commandName);
  contextStore.updateLatestIntent(normalized.chatId, normalized.userId, {
    intent: 'slash_command',
    command: commandName,
    known: Boolean(cmd)
  }, services);
  contextStore.updateLatestTopic(normalized.chatId, normalized.userId, cmd?.module || commandName, services);
  contextStore.updateLatestUserMessage(normalized.chatId, normalized.userId, normalized, services);

  recordRuntimeAudit({
    ...normalized,
    action: 'command_detected',
    command: commandName,
    intent: 'slash_command',
    resultStatus: cmd ? 'pass_through_legacy' : 'unknown_command'
  }, services);

  return {
    ok: true,
    handled: false,
    passThrough: true,
    type: 'command',
    command: cmd || null,
    normalized
  };
}

async function handleTelegramCallback(normalized = {}, services = {}) {
  if (normalized.isCommand) {
    return handleTelegramCommand(normalized, services);
  }
  contextStore.updateLatestUserMessage(normalized.chatId, normalized.userId, normalized, services);
  contextStore.updateLatestIntent(normalized.chatId, normalized.userId, {
    intent: 'callback',
    dataPreview: utils.truncateText(normalized.text || '', 80)
  }, services);
  recordRuntimeAudit({
    ...normalized,
    action: 'callback_detected',
    intent: 'callback'
  }, services);
  return {
    ok: true,
    handled: false,
    passThrough: true,
    type: 'callback',
    normalized
  };
}

async function handleTelegramNaturalMessage(normalized = {}, services = {}) {
  const followup = contextStore.resolveShortFollowupContext(normalized, services);
  const session = contextStore.getTelegramSessionContext(normalized.chatId, normalized.userId, services);
  const route = naturalRouter.routeTelegramNaturalMessage(buildUpdateForNaturalRouter(normalized), {
    ...(session || {}),
    followupContext: followup
  });

  if (normalized.secretDetected || route.blocked || route.intent === 'contains_secret') {
    const secretResponse = '⚠️ Pesan mengandung pola rahasia. Tidak akan diproses atau disimpan.';
    recordRuntimeAudit({
      ...normalized,
      action: 'message_blocked_secret',
      intent: 'contains_secret',
      allowed: false,
      reason: 'SECRET_PATTERN_DETECTED'
    }, services);
    await sendTelegramText(normalized, route.blocked ? (route.response || secretResponse) : secretResponse, services);
    return {
      ok: true,
      handled: true,
      passThrough: false,
      blocked: true,
      type: 'natural_secret_block',
      normalized,
      route
    };
  }

  contextStore.updateLatestUserMessage(normalized.chatId, normalized.userId, normalized, services);
  contextStore.updateLatestIntent(normalized.chatId, normalized.userId, {
    intent: route.intent || 'unknown',
    command: route.commandName || route.command?.name || null,
    isFollowup: Boolean(route.isFollowup || followup.isShortFollowup)
  }, services);
  if (!route.isFollowup && !followup.isShortFollowup) {
    contextStore.updateLatestTopic(normalized.chatId, normalized.userId, route.intent !== 'unknown' ? route.intent : normalized.text, services);
  }

  recordRuntimeAudit({
    ...normalized,
    action: 'natural_intent_detected',
    intent: route.intent || 'unknown',
    command: route.commandName || route.command?.name || null,
    resultStatus: 'pass_through_legacy'
  }, services);

  if (services.consumeNaturalReplies && route.response) {
    await sendTelegramText(normalized, route.response, services);
    return {
      ok: true,
      handled: true,
      passThrough: false,
      type: 'natural_response',
      normalized,
      route,
      followup
    };
  }

  return {
    ok: true,
    handled: false,
    passThrough: true,
    type: 'natural',
    normalized,
    route,
    followup
  };
}

async function dispatchTelegramUpdate(update = {}, botId = 'default', services = {}) {
  const normalized = normalizeInput(update, botId, services);
  recordRuntimeAudit({
    ...normalized,
    action: 'update_received',
    intent: normalized.isCommand ? 'slash_command' : 'incoming_update',
    command: normalized.command
  }, services);

  if (normalized.isBotMessage) {
    recordRuntimeAudit({
      ...normalized,
      action: 'ignored_bot_message',
      intent: 'bot_message',
      resultStatus: 'ignored'
    }, services);
    return {
      ok: true,
      handled: true,
      ignored: true,
      reason: 'BOT_MESSAGE',
      normalized
    };
  }

  if (!rememberMessage(normalized)) {
    recordRuntimeAudit({
      ...normalized,
      action: 'ignored_duplicate_message',
      intent: normalized.command || 'duplicate',
      resultStatus: 'ignored'
    }, services);
    return {
      ok: true,
      handled: true,
      ignored: true,
      duplicate: true,
      reason: 'DUPLICATE_MESSAGE',
      normalized
    };
  }

  if (normalized.rawType === 'callback_query' || normalized.messageType === 'callback') {
    return handleTelegramCallback(normalized, services);
  }

  if (normalized.isCommand) {
    return handleTelegramCommand(normalized, services);
  }

  if (!normalized.text && !normalized.hasAttachment) {
    return {
      ok: true,
      handled: false,
      passThrough: true,
      reason: 'NO_TEXT',
      normalized
    };
  }

  return handleTelegramNaturalMessage(normalized, services);
}

module.exports = {
  dispatchTelegramUpdate,
  handleTelegramCommand,
  handleTelegramNaturalMessage,
  handleTelegramCallback,
  clearTelegramRuntimeDispatcherState
};
