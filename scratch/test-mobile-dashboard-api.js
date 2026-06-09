'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  mobile.mobileUxStore.resetStore();
  mobile.notificationCenter.resetStore();

  // Integration: create profile
  const createResult = mobile.mobileDashboardProfile.updateMobileDashboardProfile({
    userId: 'integration_user',
    layoutMode: 'compact',
    preferredTabs: ['overview', 'agents', 'security'],
    compactMode: true,
    notificationMode: 'important',
    offlineModeEnabled: true
  }, { workspaceId: 'w1' });
  assert(createResult.ok === true, 'integration: create profile ok');
  assert(createResult.profile.layoutMode === 'compact', 'integration: profile layoutMode compact');

  // Integration: get profile
  const profile = mobile.mobileDashboardProfile.getMobileDashboardProfile('integration_user', { workspaceId: 'w1' });
  assert(profile !== null, 'integration: getProfile returns profile');
  assert(profile.compactMode === true, 'integration: compactMode true');
  assert(profile.offlineModeEnabled === true, 'integration: offlineModeEnabled true');

  // Integration: update profile
  const updateResult = mobile.mobileDashboardProfile.updateMobileDashboardProfile({
    userId: 'integration_user',
    layoutMode: 'default',
    notificationMode: 'all'
  }, { workspaceId: 'w1' });
  assert(updateResult.ok === true, 'integration: update profile ok');
  const updated = mobile.mobileDashboardProfile.getMobileDashboardProfile('integration_user', { workspaceId: 'w1' });
  assert(updated.layoutMode === 'default', 'integration: layoutMode updated to default');

  // Integration: list quick actions
  const actions = mobile.mobileQuickActions.listMobileQuickActions('integration_user', {});
  assert(actions.length === 10, 'integration: listQuickActions returns 10');
  const healthAction = mobile.mobileQuickActions.getQuickAction('open_health');
  assert(healthAction !== null, 'integration: getQuickAction open_health');

  // Integration: simulate safe action
  const sim = mobile.mobileQuickActions.simulateQuickAction('open_health', 'integration_user', {});
  assert(sim.ok === true, 'integration: simulate safe action ok');

  // Integration: execute safe action
  const exec = mobile.mobileQuickActions.executeSafeQuickAction('open_health', 'integration_user', {});
  assert(exec.ok === true, 'integration: execute safe action ok');

  // Integration: check offline status
  const status = mobile.pwaOfflineController.getPwaOfflineStatus({});
  assert(status.online === true, 'integration: offline status online');

  // Integration: cache policy
  const policy = mobile.pwaCachePolicy.getPwaCachePolicy({});
  assert(policy.excludedPatterns.includes('/api/dashboard/'), 'integration: excludes api/dashboard');

  // Integration: notification CRUD
  const notif = mobile.notificationCenter.createDashboardNotification({
    type: 'security_warning',
    severity: 'critical',
    title: 'Integration Test Alert'
  }, {});
  assert(notif.ok === true, 'integration: create notification ok');

  const notifs = mobile.notificationCenter.listDashboardNotifications({});
  assert(notifs.length >= 1, 'integration: list notifications');

  const markResult = mobile.notificationCenter.markNotificationRead(notif.notification.id, {});
  assert(markResult.ok === true, 'integration: mark notification read');

  const dismissResult = mobile.notificationCenter.dismissNotification(notif.notification.id);
  assert(dismissResult === true, 'integration: dismiss notification');

  // Integration: error state sanitization
  const errState = mobile.dashboardErrorStateManager.buildDashboardErrorState(new Error('Test error'), {});
  assert(errState.hasError === true, 'integration: error state hasError');

  // Integration: generate report
  const report = mobile.mobileUxReportGenerator.generateMobileUxReport({});
  assert(typeof report.quickActionCount === 'number', 'integration: report quickActionCount');
  assert(typeof report.notificationCount === 'number', 'integration: report notificationCount');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
