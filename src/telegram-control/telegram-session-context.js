'use strict';

const utils = require('./telegram-utils');

const MAX_CONTEXT_AGE_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const sessionStore = new Map();
let cleanupTimer = null;

function saveTelegramSessionContext(chatId, userId, context) {
  if (!chatId) return false;
  const key = String(chatId);
  const existing = sessionStore.get(key) || {};

  sessionStore.set(key, {
    ...existing,
    ...context,
    chatId: String(chatId),
    userId: userId ? String(userId) : existing.userId,
    updatedAt: utils.getCurrentTimestamp(),
    expiresAt: Date.now() + MAX_CONTEXT_AGE_MS
  });

  startCleanupTimer();
  return true;
}

function getTelegramSessionContext(chatId, userId) {
  if (!chatId) return null;
  const key = String(chatId);
  const session = sessionStore.get(key);
  if (!session) return null;

  if (session.expiresAt && Date.now() > session.expiresAt) {
    sessionStore.delete(key);
    return null;
  }

  if (userId && session.userId && String(session.userId) !== String(userId)) {
    return { ...session, crossUserAccess: true };
  }

  return session;
}

function updateLatestTopic(chatId, userId, topic) {
  if (!chatId || !topic) return false;
  return saveTelegramSessionContext(chatId, userId, { latestTopic: topic });
}

function resolveFollowupContext(message) {
  const chatId = utils.getChatId(message);
  const userId = utils.getUserId(message);
  if (!chatId) return null;

  const session = getTelegramSessionContext(chatId, userId);
  if (!session) return null;

  return {
    latestTopic: session.latestTopic || null,
    latestCommand: session.latestCommand || null,
    latestIntent: session.latestIntent || null,
    previousResponse: session.previousResponse || null,
    session
  };
}

function expireOldSessionContext() {
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

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(expireOldSessionContext, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

function getSessionStoreSize() {
  return sessionStore.size;
}

function clearAllSessions() {
  sessionStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

module.exports = {
  saveTelegramSessionContext,
  getTelegramSessionContext,
  updateLatestTopic,
  resolveFollowupContext,
  expireOldSessionContext,
  getSessionStoreSize,
  clearAllSessions
};
