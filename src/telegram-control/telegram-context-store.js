'use strict';

const utils = require('./telegram-utils');
const normalizer = require('./telegram-update-normalizer');

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const SHORT_FOLLOWUP_PATTERN = /^(iya|ya|lanjut|lanjutkan|terus|terus gimana|gimana|jelaskan|maksudnya|solusi(nya)? apa|jawaban(nya)? apa|apa yang harus saya lakukan|lanjutannya)\??$/i;

const sessionStore = new Map();
let cleanupTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function buildKey(chatId, userId) {
  if (!chatId) return '';
  return `${String(chatId)}:${userId ? String(userId) : '*'}`;
}

function sanitizeContextValue(value) {
  if (typeof value === 'string') {
    return utils.sanitizeText(value).slice(0, 2000);
  }
  if (Array.isArray(value)) return value.map(sanitizeContextValue).slice(0, 20);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|secret|password|api[_-]?key|authorization/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitizeContextValue(item);
      }
    }
    return out;
  }
  return value;
}

function sanitizeContext(context = {}) {
  const safe = sanitizeContextValue(context) || {};
  if (safe.latestUserMessage && utils.isSecretText(safe.latestUserMessage)) {
    safe.latestUserMessage = '[REDACTED_SECRET_MESSAGE]';
    safe.secretDetected = true;
  }
  return safe;
}

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(expireOldTelegramSessionContext, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

function saveTelegramSessionContext(chatId, userId, context = {}, services = {}) {
  if (!chatId) return false;
  const ttlMs = Number(services.sessionTtlMs || DEFAULT_TTL_MS);
  const key = buildKey(chatId, userId);
  const chatKey = buildKey(chatId, '*');
  const existing = sessionStore.get(key) || sessionStore.get(chatKey) || {};
  const safeContext = sanitizeContext(context);
  const record = {
    ...existing,
    ...safeContext,
    chatId: String(chatId),
    userId: userId ? String(userId) : existing.userId || '',
    updatedAt: nowIso(),
    expiresAt: Date.now() + ttlMs
  };
  sessionStore.set(key, record);
  sessionStore.set(chatKey, { ...record, userId: record.userId || '*' });
  startCleanupTimer();
  return true;
}

function getTelegramSessionContext(chatId, userId, services = {}) {
  if (!chatId) return null;
  const preferred = sessionStore.get(buildKey(chatId, userId));
  const fallback = sessionStore.get(buildKey(chatId, '*'));
  const session = preferred || fallback;
  if (!session) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) {
    sessionStore.delete(buildKey(chatId, userId));
    sessionStore.delete(buildKey(chatId, '*'));
    return null;
  }
  return {
    ...session,
    crossUserAccess: Boolean(userId && session.userId && String(session.userId) !== String(userId))
  };
}

function updateLatestUserMessage(chatId, userId, message, services = {}) {
  const normalized = typeof message === 'string'
    ? { text: message }
    : (message?.text !== undefined ? message : normalizer.normalizeTelegramUpdate(message || {}, services));
  const safeText = utils.isSecretText(normalized.text || '')
    ? '[REDACTED_SECRET_MESSAGE]'
    : utils.sanitizeText(String(normalized.text || '').slice(0, 2000));
  return saveTelegramSessionContext(chatId || normalized.chatId, userId || normalized.userId, {
    latestUserMessage: safeText,
    latestMessageId: normalized.messageId || null,
    latestMessageType: normalized.messageType || 'text',
    latestUpdatedAt: nowIso(),
    secretDetected: utils.isSecretText(normalized.text || '')
  }, services);
}

function updateLatestIntent(chatId, userId, intent, services = {}) {
  if (!chatId || !intent) return false;
  return saveTelegramSessionContext(chatId, userId, {
    latestIntent: typeof intent === 'string' ? intent : intent.intent || intent.name || 'unknown',
    latestIntentDetail: typeof intent === 'object' ? sanitizeContext(intent) : null
  }, services);
}

function updateLatestTopic(chatId, userId, topic, services = {}) {
  if (!chatId || !topic) return false;
  return saveTelegramSessionContext(chatId, userId, {
    latestTopic: typeof topic === 'string' ? utils.sanitizeText(topic) : sanitizeContext(topic)
  }, services);
}

function resolveShortFollowupContext(message, services = {}) {
  const normalized = message?.chatId !== undefined
    ? message
    : normalizer.normalizeTelegramUpdate(message || {}, services);
  const text = String(normalized.text || '').trim();
  const session = getTelegramSessionContext(normalized.chatId, normalized.userId, services);
  const replyContext = normalized.reply || {};
  const isShortFollowup = SHORT_FOLLOWUP_PATTERN.test(text);
  if (!isShortFollowup && !normalized.isReply) {
    return {
      isShortFollowup: false,
      resolved: false,
      session,
      contextText: '',
      latestTopic: session?.latestTopic || null
    };
  }

  const contextText = normalized.isReply && replyContext.replyText
    ? replyContext.replyText
    : (session?.latestUserMessage || session?.previousResponse || '');

  return {
    isShortFollowup,
    resolved: Boolean(contextText || session?.latestTopic || session?.latestIntent),
    session,
    contextText,
    latestTopic: session?.latestTopic || null,
    latestIntent: session?.latestIntent || null,
    replyContext
  };
}

function expireOldTelegramSessionContext() {
  const now = Date.now();
  for (const [key, session] of sessionStore.entries()) {
    if (session.expiresAt && now > session.expiresAt) {
      sessionStore.delete(key);
    }
  }
  if (sessionStore.size === 0 && cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

function getTelegramContextStoreSize() {
  return sessionStore.size;
}

function clearTelegramContextStore() {
  sessionStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

module.exports = {
  saveTelegramSessionContext,
  getTelegramSessionContext,
  updateLatestUserMessage,
  updateLatestIntent,
  updateLatestTopic,
  resolveShortFollowupContext,
  expireOldTelegramSessionContext,
  getTelegramContextStoreSize,
  clearTelegramContextStore,
  SHORT_FOLLOWUP_PATTERN
};
