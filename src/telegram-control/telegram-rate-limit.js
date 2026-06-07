'use strict';

const utils = require('./telegram-utils');

const RATE_LIMITS = {
  default: { maxRequests: 10, windowMs: 60000 },
  high: { maxRequests: 3, windowMs: 60000 },
  danger: { maxRequests: 1, windowMs: 120000 },
  read_only: { maxRequests: 30, windowMs: 60000 }
};

const userRateMap = new Map();
const duplicateReplyCache = new Map();
const DEDUP_TTL_MS = 5000;

function checkTelegramRateLimit(user, command) {
  if (!user) {
    return { allowed: true };
  }

  const userId = String(user.id || user.userId || user);
  const riskLevel = command ? (command.riskLevel || 'default') : 'default';
  const limitConfig = RATE_LIMITS[riskLevel] || RATE_LIMITS.default;

  const now = Date.now();
  const key = `${userId}:${riskLevel}`;

  let record = userRateMap.get(key);
  if (!record || now - record.windowStart > limitConfig.windowMs) {
    record = { windowStart: now, count: 0 };
    userRateMap.set(key, record);
  }

  record.count += 1;

  if (record.count > limitConfig.maxRequests) {
    const retryAfter = Math.ceil((limitConfig.windowMs - (now - record.windowStart)) / 1000);
    return {
      allowed: false,
      reason: `Rate limit exceeded. Please wait ${retryAfter}s.`,
      retryAfter
    };
  }

  return { allowed: true, remaining: limitConfig.maxRequests - record.count };
}

function suppressDuplicateTelegramReply(key) {
  if (!key) return false;
  const cacheKey = String(key);
  const now = Date.now();

  if (duplicateReplyCache.has(cacheKey)) {
    const entry = duplicateReplyCache.get(cacheKey);
    if (now - entry.timestamp < DEDUP_TTL_MS) {
      return true;
    }
  }

  duplicateReplyCache.set(cacheKey, { timestamp: now, count: (duplicateReplyCache.get(cacheKey)?.count || 0) + 1 });
  cleanDuplicateCache();
  return false;
}

function preventBotToBotLoop(update) {
  if (!update) return true;
  if (utils.isBotMessage(update)) {
    const text = utils.getMessageText(update) || '';
    if (!text.startsWith('/')) return true;
  }
  return false;
}

function limitVisibleAgentReplies(context) {
  const MAX_VISIBLE_REPLIES = 5;
  const COUNT_WINDOW_MS = 30000;

  if (!context || !context.chatId) return false;

  const chatId = String(context.chatId);
  const now = Date.now();
  const key = `visible_replies:${chatId}`;

  let record = userRateMap.get(key);
  if (!record || now - record.windowStart > COUNT_WINDOW_MS) {
    record = { windowStart: now, count: 0 };
    userRateMap.set(key, record);
  }

  record.count += 1;
  return record.count <= MAX_VISIBLE_REPLIES;
}

function cleanDuplicateCache() {
  const now = Date.now();
  for (const [key, entry] of duplicateReplyCache.entries()) {
    if (now - entry.timestamp > DEDUP_TTL_MS * 2) {
      duplicateReplyCache.delete(key);
    }
  }
}

function resetRateLimit(userId) {
  if (!userId) return;
  for (const [key] of userRateMap.entries()) {
    if (key.startsWith(String(userId) + ':')) {
      userRateMap.delete(key);
    }
  }
}

module.exports = {
  checkTelegramRateLimit,
  suppressDuplicateTelegramReply,
  preventBotToBotLoop,
  limitVisibleAgentReplies,
  resetRateLimit
};
