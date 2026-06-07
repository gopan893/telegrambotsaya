'use strict';

const utils = require('./operating-loop-utils');

const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const dedupCache = new Map();

const HEALTH_EMOJI = {
  healthy: '\u{1F7E2}',
  warning: '\u{1F7E1}',
  critical: '\u{1F534}',
  unknown: '\u{26AB}'
};

function getHealthEmoji(status) {
  return HEALTH_EMOJI[status] || HEALTH_EMOJI.unknown;
}

function formatDate(now) {
  return now.toISOString().split('T')[0];
}

function truncate(text, max) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.substring(0, max - 3) + '...';
}

async function buildDailyOperatingBriefing(snapshot, actions, blockers, services = {}) {
  const now = new Date();
  const date = formatDate(now);
  const health = snapshot?.healthStatus || 'unknown';
  const healthEmoji = getHealthEmoji(health);

  const topConcerns = (blockers || []).slice(0, 3).map(b => {
    const desc = b.description || b.reason || b.type || 'Unknown';
    return truncate(desc, 120);
  });

  const recommendations = (actions || []).slice(0, 3).map(a => {
    const desc = a.description || a.action || a.type || 'No description';
    return truncate(desc, 120);
  });

  const pendingApprovals = snapshot?.pendingApprovals || [];
  const blockerCount = (blockers || []).length;

  let briefing = `\u{1F916} AI OS Daily Briefing \u2014 ${date}\n`;
  briefing += `Health: ${healthEmoji} ${health}\n`;

  if (topConcerns.length > 0) {
    briefing += `Top concerns: ${topConcerns.join('; ')}\n`;
  } else {
    briefing += 'Top concerns: None\n';
  }

  if (recommendations.length > 0) {
    briefing += `Recommended: ${recommendations.join('; ')}\n`;
  } else {
    briefing += 'Recommended: None\n';
  }

  briefing += `Pending approvals: ${pendingApprovals.length}\n`;
  briefing += `Blocker count: ${blockerCount}`;

  return utils.sanitizeNotification ? utils.sanitizeNotification(briefing) : briefing;
}

async function buildWeeklyOperatingBriefing(snapshot, actions, blockers, services = {}) {
  const now = new Date();
  const date = formatDate(now);
  const health = snapshot?.healthStatus || 'unknown';
  const healthEmoji = getHealthEmoji(health);

  const topConcerns = (blockers || []).slice(0, 5).map(b => {
    const desc = b.description || b.reason || b.type || 'Unknown';
    return truncate(desc, 100);
  });

  const recommendations = (actions || []).slice(0, 5).map(a => {
    const desc = a.description || a.action || a.type || 'No description';
    return truncate(desc, 100);
  });

  const pendingApprovals = snapshot?.pendingApprovals || [];
  const blockerCount = (blockers || []).length;
  const weekNumber = getWeekNumber(now);

  let briefing = `\u{1F916} AI OS Weekly Briefing \u2014 Week ${weekNumber} (${date})\n`;
  briefing += `Health: ${healthEmoji} ${health}\n`;

  if (topConcerns.length > 0) {
    briefing += `Top concerns: ${topConcerns.join('; ')}\n`;
  } else {
    briefing += 'Top concerns: None\n';
  }

  if (recommendations.length > 0) {
    briefing += `Recommended: ${recommendations.join('; ')}\n`;
  } else {
    briefing += 'Recommended: None\n';
  }

  briefing += `Pending approvals: ${pendingApprovals.length}\n`;
  briefing += `Blocker count: ${blockerCount}`;

  return utils.sanitizeNotification ? utils.sanitizeNotification(briefing) : briefing;
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

async function buildCriticalBlockerAlert(blocker, services = {}) {
  if (!blocker) return '';

  const type = blocker.type || blocker.severity || 'unknown';
  const desc = blocker.description || blocker.reason || blocker.message || 'No details';
  const safeDesc = truncate(desc, 300);

  let alert = `\u{26A0}\u{FE0F} [${type.toUpperCase()}] ${safeDesc}`;

  if (blocker.source) {
    alert += ` (source: ${blocker.source})`;
  }

  return utils.sanitizeNotification ? utils.sanitizeNotification(alert) : alert;
}

async function buildPendingApprovalDigest(proposals, services = {}) {
  if (!proposals || proposals.length === 0) return 'No pending approvals.';

  const pending = proposals.filter(p => p.status === 'pending_approval' || p.status === 'pending');
  if (pending.length === 0) return 'No pending approvals.';

  let digest = `\u{1F4CB} Pending Approval Digest (${pending.length})\n\n`;

  for (const p of pending) {
    const title = truncate(p.title || p.description || 'Untitled', 80);
    const id = p.id || p.proposalId || 'unknown';
    const risk = p.riskLevel || 'unknown';
    digest += `\u{2022} [${id}] ${title} (risk: ${risk})\n`;
  }

  return utils.sanitizeNotification ? utils.sanitizeNotification(digest) : digest;
}

async function sendOperatingLoopNotification(notification, services = {}) {
  if (!notification) return { ok: false, error: 'no_notification' };

  const text = typeof notification === 'string' ? notification : (notification.text || notification.message || '');

  if (!text) return { ok: false, error: 'no_content' };

  if (services.telegramControl?.sendMessage) {
    try {
      const chatId = services.notificationChatId || services.chatId || process.env.OPERATING_LOOP_CHAT_ID;
      if (chatId) {
        await services.telegramControl.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return { ok: true, channel: 'telegram' };
      }
    } catch (err) {
      console.warn('[operating-loop-notifier] Telegram send failed:', err.message);
    }
  }

  if (services.telegramSender?.sendTelegramMessage) {
    try {
      const chatId = services.notificationChatId || services.chatId;
      if (chatId) {
        await services.telegramSender.sendTelegramMessage(services.bot, chatId, text);
        return { ok: true, channel: 'telegram_sender' };
      }
    } catch (err) {
      console.warn('[operating-loop-notifier] Telegram sender failed:', err.message);
    }
  }

  if (services.bot?.telegram?.sendMessage) {
    try {
      const chatId = services.notificationChatId || services.chatId;
      if (chatId) {
        await services.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return { ok: true, channel: 'telegram_bot' };
      }
    } catch (err) {
      console.warn('[operating-loop-notifier] Bot send failed:', err.message);
    }
  }

  console.log('[operating-loop-notifier] Notification:', text);
  return { ok: true, channel: 'console' };
}

async function suppressDuplicateLoopNotification(key, services = {}) {
  if (!key) return false;

  const now = Date.now();
  const last = dedupCache.get(key);

  if (last && (now - last) < DEDUP_WINDOW_MS) {
    return true;
  }

  dedupCache.set(key, now);
  return false;
}

module.exports = {
  buildDailyOperatingBriefing,
  buildWeeklyOperatingBriefing,
  buildCriticalBlockerAlert,
  buildPendingApprovalDigest,
  sendOperatingLoopNotification,
  suppressDuplicateLoopNotification
};
