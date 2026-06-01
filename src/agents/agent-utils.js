'use strict';

const { compactText, containsSecretLike, maskSecret, nowIso, sanitizeSummary } = require('../multibot/multibot-utils');

const DEFAULT_GROUP_MODE = 'natural_smart';
const GROUP_SETTINGS_KEY = 'agent_group_settings';
const AGENT_ACTIVITY_KEY = 'agent_activity_log';
const AGENT_FINGERPRINT_KEY = 'agent_recent_fingerprints';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function textIncludesAny(text, keywords = []) {
  const low = String(text || '').toLowerCase();
  return keywords.some(keyword => low.includes(String(keyword).toLowerCase()));
}

function unique(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function createId(prefix = 'item') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function safeRead(key, fallback, services = {}) {
  try {
    if (services.storageManager?.safeRead) return await services.storageManager.safeRead(key, fallback);
    if (services.storage?.safeRead) return await services.storage.safeRead(key, fallback);
  } catch (_) {}
  if (!services.__agentMemory) services.__agentMemory = {};
  return Object.prototype.hasOwnProperty.call(services.__agentMemory, key) ? services.__agentMemory[key] : fallback;
}

async function safeWrite(key, value, services = {}) {
  try {
    if (services.storageManager?.safeWrite) return await services.storageManager.safeWrite(key, value);
    if (services.storage?.safeWrite) return await services.storage.safeWrite(key, value);
  } catch (_) {}
  if (!services.__agentMemory) services.__agentMemory = {};
  services.__agentMemory[key] = value;
  return value;
}

function buildMessageFingerprint(event = {}) {
  const chatId = event.chatId || event.update?.message?.chat?.id || '0';
  const messageId = event.messageId || event.update?.message?.message_id || '';
  const text = compactText(event.text || event.update?.message?.text || '', 80).toLowerCase();
  return `${chatId}:${messageId || text}`;
}

function isLikelyBotMessage(update = {}) {
  return Boolean(update.message?.from?.is_bot || update.callback_query?.from?.is_bot);
}

function buildSafeText(text, max = 700) {
  return compactText(maskSecret(text), max);
}

module.exports = {
  AGENT_ACTIVITY_KEY,
  AGENT_FINGERPRINT_KEY,
  DEFAULT_GROUP_MODE,
  GROUP_SETTINGS_KEY,
  buildMessageFingerprint,
  buildSafeText,
  compactText,
  containsSecretLike,
  createId,
  isLikelyBotMessage,
  maskSecret,
  normalizeId,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeSummary,
  textIncludesAny,
  unique
};
