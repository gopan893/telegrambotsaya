'use strict';

function createOperationsMonitor(options = {}) {
  const telegram = options.telegram;
  const chatId = options.chatId;
  const sandbox = options.sandbox;
  const alertRateLimitMs = options.alertRateLimitMs === undefined ? 60000 : options.alertRateLimitMs;

  const logs = [];
  const maxLogs = 100;
  let lastAlertTs = 0;

  function logEvent(level, message) {
    const entry = {
      level,
      message,
      ts: Date.now()
    };
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    return entry;
  }

  function getMetrics() {
    const totalEvents = logs.length;
    const errors = logs.filter(l => l.level === 'error').length;
    return {
      totalEvents,
      errors,
      successRate: totalEvents > 0 ? ((totalEvents - errors) / totalEvents) * 100 : 100
    };
  }

  async function triggerAlert(message) {
    const now = Date.now();
    if (now - lastAlertTs < alertRateLimitMs) {
      return false;
    }
    lastAlertTs = now;

    if (telegram && typeof telegram.sendMessage === 'function' && chatId) {
      try {
        await telegram.sendMessage(chatId, `🚨 *BOT OBSERVABILITY ALERT*\n\n${message}`);
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
        await triggerAlert(`Deploy health check failed for branch: ${branch}. Reverting branch changes.`);
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

  return { logEvent, getMetrics, triggerAlert, verifyDeployAndRollback };
}

module.exports = { createOperationsMonitor };
