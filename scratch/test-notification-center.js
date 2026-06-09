'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  mobile.notificationCenter.resetStore();

  // createDashboardNotification
  const created = mobile.notificationCenter.createDashboardNotification({
    type: 'security_warning',
    severity: 'critical',
    title: 'Security Alert',
    summary: 'A security incident was detected',
    sourceModule: 'security',
    targetTab: 'security',
    actionLabel: 'View',
    actionHref: '/dashboard?tab=security'
  }, {});
  assert(created.ok === true, 'createDashboardNotification ok');
  assert(created.notification.type === 'security_warning', 'notification type set');
  assert(created.notification.severity === 'critical', 'notification severity critical');
  assert(created.notification.read === false, 'notification unread');

  // createDashboardNotification with invalid type
  const invalid = mobile.notificationCenter.createDashboardNotification({
    type: 'invalid_type',
    title: 'Test'
  }, {});
  assert(invalid.ok === false, 'invalid type fails');

  // createDashboardNotification without title
  const noTitle = mobile.notificationCenter.createDashboardNotification({
    type: 'security_warning'
  }, {});
  assert(noTitle.ok === false, 'missing title fails');

  // listDashboardNotifications
  await mobile.notificationCenter.createDashboardNotification({
    type: 'privacy_warning', severity: 'warning', title: 'Privacy Alert'
  }, {});
  const all = mobile.notificationCenter.listDashboardNotifications({});
  assert(all.length >= 2, 'listDashboardNotifications returns at least 2');

  // listDashboardNotifications with filter
  const filtered = mobile.notificationCenter.listDashboardNotifications({ type: 'privacy_warning' });
  assert(filtered.length >= 1, 'filter by type works');
  assert(filtered.every(n => n.type === 'privacy_warning'), 'all filtered notifications have correct type');

  // markNotificationRead
  const firstId = all[0].id;
  const marked = mobile.notificationCenter.markNotificationRead(firstId, {});
  assert(marked.ok === true, 'markNotificationRead ok');
  assert(marked.notification.read === true, 'notification marked read');

  // markNotificationRead - not found
  const notFound = mobile.notificationCenter.markNotificationRead('nonexistent', {});
  assert(notFound.ok === false, 'markNotificationRead nonexistent fails');

  // dismissNotification
  const dismissed = mobile.notificationCenter.dismissNotification(firstId);
  assert(dismissed === true, 'dismissNotification returns true');
  const afterDismiss = mobile.notificationCenter.listDashboardNotifications({});
  assert(afterDismiss.every(n => n.id !== firstId), 'dismissed notification removed');

  // suppressDuplicateNotification
  const first = mobile.notificationCenter.suppressDuplicateNotification('dup-key', {});
  assert(first === true, 'first suppression returns true');
  const second = mobile.notificationCenter.suppressDuplicateNotification('dup-key', {});
  assert(second === false, 'second suppression returns false');

  // buildNotificationDigest
  const digest = mobile.notificationCenter.buildNotificationDigest({});
  assert(typeof digest.total === 'number', 'digest total is number');
  assert(typeof digest.unread === 'number', 'digest unread is number');
  assert(typeof digest.critical === 'number', 'digest critical is number');
  assert(Array.isArray(digest.byType), 'digest byType is array');
  assert(Array.isArray(digest.recentUnread), 'digest recentUnread is array');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
