'use strict';

const SECRET_PATTERNS = [
  /token/i, /secret/i, /password/i, /api_key/i, /apikey/i,
  /authorization/i, /bearer/i, /database_url/i, /redis_url/i,
  /postgresql:\/\//i, /rediss:\/\//i, /sk-/i, /ghp_/i,
  /github_pat_/i, /gsk_/i, /tvly_/i, /telegram_token/i,
  /github_token/i, /google_client_secret/i, /cloudflare_api_token/i,
  /render_deploy_hook/i
];

function isSecretText(text) {
  if (!text || typeof text !== 'string') return false;
  return SECRET_PATTERNS.some(p => p.test(text));
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/(sk-[A-Za-z0-9]{10,})/g, '[REDACTED_API_KEY]')
    .replace(/(ghp_[A-Za-z0-9]{10,})/g, '[REDACTED_GH_TOKEN]')
    .replace(/(github_pat_[A-Za-z0-9_]{10,})/g, '[REDACTED_GH_PAT]')
    .replace(/(gsk_[A-Za-z0-9]{10,})/g, '[REDACTED_GSK_KEY]')
    .replace(/(tvly_[A-Za-z0-9]{10,})/g, '[REDACTED_TVLY_KEY]')
    .replace(/(postgresql:\/\/[^\s]+)/g, '[REDACTED_DB_URL]')
    .replace(/(rediss:\/\/[^\s]+)/g, '[REDACTED_REDIS_URL]')
    .replace(/(TELEGRAM_TOKEN=)[^\s]+/g, '$1[REDACTED]')
    .replace(/(GITHUB_TOKEN=)[^\s]+/g, '$1[REDACTED]')
    .replace(/(GOOGLE_CLIENT_SECRET=)[^\s]+/g, '$1[REDACTED]')
    .replace(/(CLOUDFLARE_API_TOKEN=)[^\s]+/g, '$1[REDACTED]')
    .replace(/(RENDER_DEPLOY_HOOK=)[^\s]+/g, '$1[REDACTED]');
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function generateId(prefix) {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${prefix || 'tc'}_${ts}_${rnd}`;
}

function chunkArray(arr, size) {
  if (!Array.isArray(arr)) return [];
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function truncateText(text, maxLen) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function safeString(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function isBotMessage(update) {
  if (!update) return false;
  const msg = update.message || update.callback_query?.message || update.edited_message;
  if (!msg) return false;
  return msg.from?.is_bot === true;
}

function getChatId(update) {
  if (update?.message?.chat?.id) return update.message.chat.id;
  if (update?.callback_query?.message?.chat?.id) return update.callback_query.message.chat.id;
  if (update?.edited_message?.chat?.id) return update.edited_message.chat.id;
  return null;
}

function getUserId(update) {
  if (update?.message?.from?.id) return update.message.from.id;
  if (update?.callback_query?.from?.id) return update.callback_query.from.id;
  if (update?.edited_message?.from?.id) return update.edited_message.from.id;
  return null;
}

function getMessageText(update) {
  if (update?.message?.text) return update.message.text;
  if (update?.callback_query?.data) return update.callback_query.data;
  if (update?.edited_message?.text) return update.edited_message.text;
  return '';
}

function getMessageId(update) {
  if (update?.message?.message_id) return update.message.message_id;
  if (update?.callback_query?.message?.message_id) return update.callback_query.message.message_id;
  return null;
}

module.exports = {
  isSecretText,
  sanitizeText,
  getCurrentTimestamp,
  generateId,
  chunkArray,
  truncateText,
  safeString,
  isBotMessage,
  getChatId,
  getUserId,
  getMessageText,
  getMessageId
};
