'use strict';

const guards = require('./conversation-guards');

const DEFAULT_TTL_MS = 45 * 60 * 1000;
const DEFAULT_MAX_MESSAGES = 8;
const states = new Map();

function makeKey(userId, chatId) {
  return `${guards.safeText(userId)}:${guards.safeText(chatId)}`;
}

function emptyState(userId, chatId, options = {}) {
  const now = guards.nowMs();
  return {
    userId: guards.safeText(userId),
    chatId: guards.safeText(chatId),
    activeTopic: '',
    activeIntent: '',
    detectedMode: '',
    lastUserMessage: '',
    lastBotResponseSummary: '',
    lastResponseId: '',
    pendingActionId: '',
    recentMessages: [],
    updatedAt: now,
    expiresAt: now + Number(options.ttlMs || DEFAULT_TTL_MS)
  };
}

function isExpired(state) {
  return !state || guards.nowMs() > Number(state.expiresAt || 0);
}

function getDialogueState(userId, chatId, options = {}) {
  const key = makeKey(userId, chatId);
  const existing = states.get(key);

  if (existing && !isExpired(existing)) {
    return existing;
  }

  const state = emptyState(userId, chatId, options);
  states.set(key, state);
  return state;
}

function updateDialogueState(userId, chatId, patch = {}, options = {}) {
  const state = getDialogueState(userId, chatId, options);
  const maxMessages = Number(options.maxMessages || DEFAULT_MAX_MESSAGES);
  const now = guards.nowMs();

  Object.assign(state, patch, {
    updatedAt: now,
    expiresAt: now + Number(options.ttlMs || DEFAULT_TTL_MS)
  });

  state.recentMessages = guards.safeJsonArray(state.recentMessages).slice(-maxMessages);
  states.set(makeKey(userId, chatId), state);
  cleanupExpiredDialogueStates();
  return state;
}

function addDialogueMessage(userId, chatId, role, content, meta = {}, options = {}) {
  const state = getDialogueState(userId, chatId, options);
  const maxMessages = Number(options.maxMessages || DEFAULT_MAX_MESSAGES);
  const clean = guards.compactText(content, 900);
  if (!clean) return state;

  state.recentMessages.push({
    role,
    content: clean,
    intent: meta.intent || '',
    topic: meta.topic || '',
    createdAt: guards.nowMs()
  });
  state.recentMessages = state.recentMessages.slice(-maxMessages);

  if (role === 'user') state.lastUserMessage = clean;
  if (role === 'assistant') state.lastBotResponseSummary = guards.compactText(clean, 420);
  if (meta.topic) state.activeTopic = guards.compactText(meta.topic, 140);
  if (meta.intent) state.activeIntent = meta.intent;
  if (meta.detectedMode) state.detectedMode = meta.detectedMode;
  if (meta.pendingActionId) state.pendingActionId = meta.pendingActionId;

  return updateDialogueState(userId, chatId, state, options);
}

function clearDialogueState(userId, chatId) {
  states.delete(makeKey(userId, chatId));
}

function cleanupExpiredDialogueStates() {
  for (const [key, state] of states.entries()) {
    if (isExpired(state)) states.delete(key);
  }
}

module.exports = {
  addDialogueMessage,
  cleanupExpiredDialogueStates,
  clearDialogueState,
  getDialogueState,
  isExpired,
  updateDialogueState
};
