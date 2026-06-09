'use strict';

const { createId, sanitizeMobileData, nowIso } = require('./mobile-utils');

const notifications = new Map();
const suppressionKeys = new Set();

const NOTIFICATION_TYPES = [
  'security_warning', 'privacy_warning', 'reliability_warning', 'pending_approval',
  'failed_workflow', 'deploy_warning', 'recipe_warning', 'model_router_warning',
  'docs_gap', 'backup_warning', 'dr_warning', 'release_warning'
];

const SEVERITIES = ['info', 'warning', 'critical'];

function createDashboardNotification(input, services) {
  if (!input || !input.type || !input.title) {
    return { ok: false, error: 'type and title are required' };
  }
  if (!NOTIFICATION_TYPES.includes(input.type)) {
    return { ok: false, error: `Invalid notification type: ${input.type}` };
  }
  if (input.severity && !SEVERITIES.includes(input.severity)) {
    input.severity = 'info';
  }
  if (input.severity === undefined) input.severity = 'info';
  const workspaceId = (services && services.workspaceId) || 'default';
  const notification = {
    id: createId('notif'),
    workspaceId,
    type: input.type,
    severity: input.severity,
    title: input.title,
    summary: input.summary || '',
    sourceModule: input.sourceModule || '',
    targetTab: input.targetTab || '',
    actionLabel: input.actionLabel || '',
    actionHref: input.actionHref || '',
    read: false,
    createdAt: nowIso()
  };
  const sanitized = sanitizeMobileData(notification);
  notifications.set(sanitized.id, sanitized);
  return { ok: true, notification: sanitized };
}

function listDashboardNotifications(filters, services) {
  let result = Array.from(notifications.values());
  if (filters) {
    if (filters.type) result = result.filter(n => n.type === filters.type);
    if (filters.severity) result = result.filter(n => n.severity === filters.severity);
    if (filters.read !== undefined) result = result.filter(n => n.read === filters.read);
    if (filters.workspaceId) result = result.filter(n => n.workspaceId === filters.workspaceId);
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function markNotificationRead(id, services) {
  const notif = notifications.get(id);
  if (!notif) return { ok: false, error: 'Notification not found' };
  notif.read = true;
  return { ok: true, notification: notif };
}

function dismissNotification(id, services) {
  return notifications.delete(id);
}

function suppressDuplicateNotification(key, services) {
  if (suppressionKeys.has(key)) return false;
  suppressionKeys.add(key);
  return true;
}

function buildNotificationDigest(services) {
  const all = Array.from(notifications.values());
  const unread = all.filter(n => !n.read);
  const critical = all.filter(n => n.severity === 'critical');
  const warnings = all.filter(n => n.severity === 'warning');
  const info = all.filter(n => n.severity === 'info');
  const byType = {};
  for (const n of all) {
    if (!byType[n.type]) byType[n.type] = [];
    byType[n.type].push(n);
  }
  return {
    total: all.length,
    unread: unread.length,
    critical: critical.length,
    warnings: warnings.length,
    info: info.length,
    byType: Object.keys(byType).map(t => ({ type: t, count: byType[t].length })),
    recentUnread: unread.slice(0, 10)
  };
}

function resetStore() {
  notifications.clear();
  suppressionKeys.clear();
}

module.exports = {
  createDashboardNotification,
  listDashboardNotifications,
  markNotificationRead,
  dismissNotification,
  suppressDuplicateNotification,
  buildNotificationDigest,
  resetStore,
  NOTIFICATION_TYPES
};
