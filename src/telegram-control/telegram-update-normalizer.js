'use strict';

const utils = require('./telegram-utils');

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null);
}

function sanitizeValue(value) {
  return typeof value === 'string' ? utils.sanitizeText(value) : value;
}

function extractTelegramMessage(update = {}) {
  return update.message
    || update.edited_message
    || update.channel_post
    || update.edited_channel_post
    || update.callback_query?.message
    || null;
}

function extractTelegramText(update = {}) {
  const cbData = update.callback_query?.data;
  if (typeof cbData === 'string' && cbData.trim()) return utils.sanitizeText(cbData.trim());

  const msg = extractTelegramMessage(update);
  const text = firstDefined(msg?.text, msg?.caption);
  return typeof text === 'string' ? utils.sanitizeText(text.trim()) : '';
}

function extractTelegramRawText(update = {}) {
  const cbData = update.callback_query?.data;
  if (typeof cbData === 'string' && cbData.trim()) return cbData.trim();
  const msg = extractTelegramMessage(update);
  const text = firstDefined(msg?.text, msg?.caption);
  return typeof text === 'string' ? text.trim() : '';
}

function extractTelegramChat(update = {}) {
  const msg = extractTelegramMessage(update);
  return msg?.chat || null;
}

function extractTelegramUser(update = {}) {
  if (update.callback_query?.from) return update.callback_query.from;
  const msg = extractTelegramMessage(update);
  return msg?.from || msg?.sender_chat || null;
}

function extractTelegramMessageType(update = {}) {
  if (update.callback_query) return 'callback';
  const msg = extractTelegramMessage(update);
  if (!msg) return 'unknown';
  if (msg.photo) return 'photo';
  if (msg.document) return 'document';
  if (msg.video) return 'video';
  if (msg.audio) return 'audio';
  if (msg.voice) return 'voice';
  if (msg.sticker) return 'sticker';
  if (msg.text) return 'text';
  if (msg.caption) return 'caption';
  return 'unknown';
}

function extractRawType(update = {}) {
  if (update.callback_query) return 'callback_query';
  if (update.edited_message) return 'edited_message';
  if (update.channel_post) return 'channel_post';
  if (update.edited_channel_post) return 'edited_channel_post';
  if (update.message) return 'message';
  return 'unknown';
}

function extractTelegramReplyContext(update = {}) {
  const msg = extractTelegramMessage(update);
  const reply = msg?.reply_to_message || null;
  if (!reply) {
    return {
      isReply: false,
      replyToMessageId: null,
      replyText: '',
      replyFromUserId: null,
      replyFromBot: false
    };
  }

  const replyText = firstDefined(reply.text, reply.caption, '');
  return {
    isReply: true,
    replyToMessageId: reply.message_id || null,
    replyText: sanitizeValue(String(replyText || '').trim()),
    replyFromUserId: reply.from?.id || null,
    replyFromBot: reply.from?.is_bot === true
  };
}

function parseCommand(text = '') {
  const clean = String(text || '').trim();
  if (!clean.startsWith('/')) {
    return { isCommand: false, command: null, args: '' };
  }

  const first = clean.split(/\s+/)[0] || '';
  const command = first.replace(/^\//, '').split('@')[0].toLowerCase();
  const args = clean.slice(first.length).trim();
  return {
    isCommand: Boolean(command),
    command: command || null,
    args
  };
}

function buildDisplayName(user = {}) {
  if (!user) return '';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return sanitizeValue(name || user.username || user.title || '');
}

function normalizeTelegramUpdate(update = {}, services = {}) {
  const raw = update && typeof update === 'object' ? update : {};
  const msg = extractTelegramMessage(raw);
  const chat = extractTelegramChat(raw) || {};
  const user = extractTelegramUser(raw) || {};
  const rawText = extractTelegramRawText(raw);
  const text = extractTelegramText(raw);
  const parsed = parseCommand(text);
  const reply = extractTelegramReplyContext(raw);
  const messageType = extractTelegramMessageType(raw);
  const rawType = extractRawType(raw);
  const messageDate = msg?.date || raw.callback_query?.message?.date || null;
  const createdAt = messageDate
    ? new Date(Number(messageDate) * 1000).toISOString()
    : new Date().toISOString();

  return {
    updateId: raw.update_id ?? null,
    botId: raw.__botId || msg?.__botId || raw.callback_query?.__botId || services.botId || 'default',
    chatId: chat.id ?? null,
    chatType: chat.type || (raw.channel_post || raw.edited_channel_post ? 'channel' : 'private'),
    userId: user.id ?? null,
    username: sanitizeValue(user.username || ''),
    displayName: buildDisplayName(user),
    messageId: msg?.message_id ?? raw.callback_query?.id ?? null,
    text,
    secretDetected: utils.isSecretText(rawText),
    command: parsed.command,
    args: parsed.args,
    isCommand: parsed.isCommand,
    isBotMessage: user.is_bot === true,
    isReply: reply.isReply,
    replyToMessageId: reply.replyToMessageId,
    messageType,
    rawType,
    callbackQueryId: raw.callback_query?.id || null,
    entities: msg?.entities || msg?.caption_entities || [],
    botMentioned: Array.isArray(msg?.entities || msg?.caption_entities)
      ? (msg.entities || msg.caption_entities || []).some(entity => entity.type === 'bot_command' || entity.type === 'mention')
      : false,
    reply,
    hasAttachment: Boolean(msg?.photo || msg?.document || msg?.video || msg?.audio || msg?.voice),
    createdAt
  };
}

module.exports = {
  normalizeTelegramUpdate,
  extractTelegramMessage,
  extractTelegramText,
  extractTelegramRawText,
  extractTelegramChat,
  extractTelegramUser,
  extractTelegramMessageType,
  extractTelegramReplyContext
};
