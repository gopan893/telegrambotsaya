'use strict';

function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      // Sensor token Telegram pattern
      if (/[0-9]{8,10}:[A-Za-z0-9_-]{35}/.test(obj)) {
        return '[REDACTED_TELEGRAM_TOKEN]';
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }
  const redacted = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    const isSecretKey = /token|api_?key|password|authorization|secret/i.test(k);
    if (isSecretKey && typeof val === 'string') {
      redacted[k] = '[REDACTED_SECRET]';
    } else {
      redacted[k] = redactSecrets(val);
    }
  }
  return redacted;
}

function createOperationsMonitor(options = {}) {
  const telegram = options.telegram;
  const chatId = options.chatId;
  const sandbox = options.sandbox;
  const alertRateLimitMs = options.alertRateLimitMs === undefined ? 900000 : options.alertRateLimitMs; // Default 15 minutes
  const nowFn = options.now || (() => Date.now());

  const logs = [];
  const maxLogs = 100;
  const alertFingerprints = new Map();

  function logEvent(level, message, context = null) {
    const entry = {
      level,
      message: typeof message === 'string' ? redactSecrets(message) : message,
      context: redactSecrets(context),
      ts: nowFn()
    };
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    return entry;
  }

  function getMetrics() {
    const totalEvents = logs.length;
    const errors = logs.filter(l => l.level === 'error').length;
    
    // Count errors in the last 15 minutes
    const fifteenMinsAgo = nowFn() - 900000;
    const recentErrors = logs.filter(l => l.level === 'error' && l.ts >= fifteenMinsAgo).length;

    return {
      totalEvents,
      errors,
      recentErrors,
      successRate: totalEvents > 0 ? ((totalEvents - errors) / totalEvents) * 100 : 100
    };
  }

  async function triggerAlert(fingerprint, message = '') {
    const now = nowFn();
    const lastAlert = alertFingerprints.get(fingerprint) || 0;
    if (now - lastAlert < alertRateLimitMs) {
      return false;
    }
    alertFingerprints.set(fingerprint, now);

    const alertMsg = message || fingerprint;
    if (telegram && typeof telegram.sendMessage === 'function' && chatId) {
      try {
        await telegram.sendMessage(chatId, `🚨 *BOT OBSERVABILITY ALERT*\n\n${alertMsg}`);
        return true;
      } catch (_) {}
    }
    return false;
  }

  async function verifyDeployAndRollback({ healthCheck, branch }) {
    if (typeof healthCheck !== 'function') return true;
    try {
      const ok = await healthCheck();
      if (!ok) {
        logEvent('error', `Deploy health check failed for branch: ${branch}. Rolling back.`);
        await triggerAlert(`deploy_fail_${branch}`, `Deploy health check failed for branch: ${branch}. Reverting branch changes.`);
        if (sandbox && typeof sandbox.rollback === 'function') {
          sandbox.rollback(branch);
        }
        return false;
      }
      return true;
    } catch (err) {
      logEvent('error', `Deploy health check exception: ${err.message}`);
      if (sandbox && typeof sandbox.rollback === 'function') {
        sandbox.rollback(branch);
      }
      return false;
    }
  }

  return { logEvent, getMetrics, triggerAlert, verifyDeployAndRollback, redactSecrets };
}

module.exports = { createOperationsMonitor, redactSecrets };
