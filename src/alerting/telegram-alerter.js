'use strict';

const { createLogger } = require('../../core/logger');
const { CircuitBreaker } = require('../../core/circuit-breaker');

const log = createLogger('telegram-alerter');

const rateLimitMap = new Map();
const RATE_LIMIT_MS = 5 * 60 * 1000;

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 60 * 1000
});

function getLevel(env) {
  return (env.ALERT_MIN_LEVEL || process.env.ALERT_MIN_LEVEL || 'warning');
}

function isAlertEnabled(env) {
  if (env.ALERT_ENABLED !== undefined) {
    return String(env.ALERT_ENABLED).toLowerCase() !== 'false';
  }
  return String(process.env.ALERT_ENABLED || '').toLowerCase() !== 'false';
}

function getOwnerChatId(env) {
  return env.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '';
}

function getTelegramToken(env) {
  const token = env.TELEGRAM_TOKEN || env.PRIMARY_TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN_ORCHESTRATOR || '';
  return token;
}

const LEVEL_PRIORITY = { info: 0, warning: 1, critical: 2 };

function shouldSend(message, level) {
  const minLevel = getLevel(process.env);
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function isRateLimited(message, level) {
  const key = `${level}:${message.slice(0, 80)}`;
  const now = Date.now();
  const last = rateLimitMap.get(key);
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(key, now);
  if (rateLimitMap.size > 500) {
    const cutoff = now - RATE_LIMIT_MS;
    for (const [k, ts] of rateLimitMap) {
      if (ts < cutoff) rateLimitMap.delete(k);
    }
  }
  return false;
}

async function sendOwnerAlert(message, level) {
  try {
    if (!isAlertEnabled(process.env)) return { ok: false, reason: 'alerting_disabled' };

    const token = getTelegramToken(process.env);
    const ownerId = getOwnerChatId(process.env);

    if (!token || !ownerId) {
      log.warn('Alert not sent: TELEGRAM_TOKEN or OWNER_CHAT_ID not configured');
      return { ok: false, reason: 'missing_config' };
    }

    const finalLevel = level || 'warning';
    if (!shouldSend(message, finalLevel)) return { ok: false, reason: 'below_min_level' };

    if (isRateLimited(message, finalLevel)) {
      log.info(`Alert rate limited: ${finalLevel}:${message.slice(0, 60)}`);
      return { ok: false, reason: 'rate_limited' };
    }

    const breakerKey = `alert:${finalLevel}:${message.slice(0, 60)}`;
    if (!circuitBreaker.canRun(breakerKey)) {
      log.warn(`Circuit breaker open for: ${breakerKey}`);
      return { ok: false, reason: 'circuit_open' };
    }

    try {
      const label = finalLevel.toUpperCase();
      const timestamp = new Date().toISOString();
      const text = `[${label}] Bot alert: ${message} — Time: ${timestamp}`;

      const axios = require('axios');
      const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await axios.post(apiUrl, {
        chat_id: ownerId,
        text: text.slice(0, 4000),
        parse_mode: 'HTML'
      }, {
        timeout: 10000
      });

      if (response.data?.ok) {
        circuitBreaker.success(breakerKey);
        log.info(`Alert sent: ${finalLevel}`);
        return { ok: true };
      }

      circuitBreaker.failure(breakerKey);
      log.error('Alert send failed', response.data);
      return { ok: false, reason: 'telegram_api_error' };
    } catch (err) {
      circuitBreaker.failure(breakerKey);
      throw err;
    }
  } catch (err) {
    log.error('Alert error:', err.message);
    return { ok: false, reason: err.message };
  }
}

module.exports = {
  sendOwnerAlert,
  isAlertEnabled,
  getLevel
};
