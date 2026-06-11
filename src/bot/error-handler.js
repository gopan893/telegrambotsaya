'use strict';

const ADMIN_NOTIFY_TTL_MS = 60 * 1000;
const lastAdminNotification = new Map();

let alerter = null;
function setAlerter(instance) {
  alerter = instance;
}

function normalizeError(error) {
  if (!error) return { message: 'Unknown error', code: 'UNKNOWN' };
  return {
    message: error.message || String(error),
    code: error.code || error.name || 'ERROR',
    status: error.response?.status || error.status || null
  };
}

function redact(text) {
  return String(text || '')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/gi, '$1=[redacted]');
}

function logError(scope, error, meta = {}, logger = console) {
  const normalized = normalizeError(error);
  const payload = {
    scope,
    code: normalized.code,
    status: normalized.status,
    message: redact(normalized.message),
    meta
  };

  if (logger && typeof logger.error === 'function') {
    logger.error(`[${scope}]`, payload);
  } else {
    console.error(`[${scope}]`, payload);
  }

  return payload;
}

function buildSafeErrorMessage() {
  return 'Maaf, saya sedang mengalami kendala memproses pesan ini. Coba ulangi sebentar lagi.';
}

function isAdminUser(userId, context = {}) {
  const id = String(userId || '');
  const config = context.config || {};
  if (!id) return false;
  if (String(config.OWNER_CHAT_ID || '') === id) return true;
  if (config.ADMIN_SET && typeof config.ADMIN_SET.has === 'function') return config.ADMIN_SET.has(id);
  return String(config.ADMIN_IDS || '').split(',').map(x => x.trim()).includes(id);
}

async function notifyAdminIfNeeded(context = {}, error, meta = {}) {
  const ownerId = String(context.config?.OWNER_CHAT_ID || '');
  if (!ownerId || typeof context.sendTelegramMessage !== 'function') return false;

  const now = Date.now();
  const key = `${meta.scope || 'bot'}:${normalizeError(error).code}`;
  if (now - Number(lastAdminNotification.get(key) || 0) < ADMIN_NOTIFY_TTL_MS) return false;
  lastAdminNotification.set(key, now);

  const message = [
    'Bot error:',
    `Scope: ${meta.scope || '-'}`,
    `Code: ${normalizeError(error).code}`,
    `Message: ${redact(normalizeError(error).message).slice(0, 500)}`
  ].join('\n');

  try {
    await context.sendTelegramMessage(context.bot, ownerId, message);
  } catch (_) {}

  if (alerter && typeof alerter.sendOwnerAlert === 'function') {
    try {
      await alerter.sendOwnerAlert(`Scope: ${meta.scope || '-'} Code: ${normalizeError(error).code} Message: ${redact(normalizeError(error).message).slice(0, 200)}`, 'error');
    } catch (_) {}
  }

  return true;
}

module.exports = {
  buildSafeErrorMessage,
  isAdminUser,
  logError,
  normalizeError,
  notifyAdminIfNeeded,
  setAlerter
};
