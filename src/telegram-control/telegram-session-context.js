'use strict';

const contextStore = require('./telegram-context-store');

function saveTelegramSessionContext(chatId, userId, context, services) {
  return contextStore.saveTelegramSessionContext(chatId, userId, context, services);
}

function getTelegramSessionContext(chatId, userId, services) {
  return contextStore.getTelegramSessionContext(chatId, userId, services);
}

function updateLatestTopic(chatId, userId, topic, services) {
  return contextStore.updateLatestTopic(chatId, userId, topic, services);
}

function resolveFollowupContext(message, services) {
  const result = contextStore.resolveShortFollowupContext(message, services);
  if (!result?.session) return null;
  return {
    latestTopic: result.session.latestTopic || null,
    latestCommand: result.session.latestCommand || null,
    latestIntent: result.session.latestIntent || null,
    previousResponse: result.session.previousResponse || null,
    session: result.session,
    resolved: result.resolved,
    contextText: result.contextText
  };
}

function expireOldSessionContext() {
  return contextStore.expireOldTelegramSessionContext();
}

function getSessionStoreSize() {
  return contextStore.getTelegramContextStoreSize();
}

function clearAllSessions() {
  return contextStore.clearTelegramContextStore();
}

module.exports = {
  saveTelegramSessionContext,
  getTelegramSessionContext,
  updateLatestUserMessage: contextStore.updateLatestUserMessage,
  updateLatestIntent: contextStore.updateLatestIntent,
  updateLatestTopic,
  resolveFollowupContext,
  resolveShortFollowupContext: contextStore.resolveShortFollowupContext,
  expireOldSessionContext,
  getSessionStoreSize,
  clearAllSessions
};
