'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  mobile.mobileUxStore.resetStore();

  // getMobileDashboardProfile with null user returns default
  const defaultProfile = mobile.mobileDashboardProfile.getMobileDashboardProfile(null, {});
  assert(defaultProfile.userId === 'unknown', 'null user gets unknown userId');
  assert(defaultProfile.layoutMode === 'default', 'default layoutMode');

  // getMobileDashboardProfile with real user returns default when none stored
  const userProfile = mobile.mobileDashboardProfile.getMobileDashboardProfile('user1', {});
  assert(userProfile.userId === 'user1', 'getProfile returns profile for user1');
  assert(userProfile.notificationMode === 'all', 'notificationMode defaults to all');
  assert(userProfile.offlineModeEnabled === false, 'offlineModeEnabled defaults false');

  // updateMobileDashboardProfile stores profile
  const updateResult = mobile.mobileDashboardProfile.updateMobileDashboardProfile({
    userId: 'user1',
    layoutMode: 'compact',
    preferredTabs: ['overview', 'agents'],
    compactMode: true,
    notificationMode: 'important'
  }, {});
  assert(updateResult.ok === true, 'updateMobileDashboardProfile ok');
  assert(updateResult.profile.layoutMode === 'compact', 'layoutMode updated to compact');
  assert(updateResult.profile.compactMode === true, 'compactMode true');

  // getMobileDashboardProfile returns updated profile
  const updated = mobile.mobileDashboardProfile.getMobileDashboardProfile('user1', {});
  assert(updated.layoutMode === 'compact', 'getProfile returns updated layoutMode');
  assert(updated.compactMode === true, 'getProfile returns updated compactMode');
  assert(updated.notificationMode === 'important', 'getProfile returns updated notificationMode');

  // validateMobileProfile - valid
  const valid = mobile.mobileDashboardProfile.validateMobileProfile({
    userId: 'test',
    layoutMode: 'default',
    notificationMode: 'all'
  });
  assert(valid.valid === true, 'valid profile passes validation');

  // validateMobileProfile - invalid layoutMode
  const invalidLayout = mobile.mobileDashboardProfile.validateMobileProfile({
    userId: 'test',
    layoutMode: 'invalid'
  });
  assert(invalidLayout.valid === false, 'invalid layoutMode fails validation');

  // validateMobileProfile - secrets detected
  const withSecret = mobile.mobileDashboardProfile.validateMobileProfile({
    userId: 'test',
    secrets: 'should not be here'
  });
  assert(withSecret.valid === false, 'profile with secrets fails validation');

  // validateMobileProfile - null profile
  const nullProfile = mobile.mobileDashboardProfile.validateMobileProfile(null);
  assert(nullProfile.valid === false, 'null profile fails validation');

  // buildDefaultMobileProfile
  const built = mobile.mobileDashboardProfile.buildDefaultMobileProfile('newuser', {});
  assert(built.userId === 'newuser', 'buildDefaultMobileProfile sets userId');
  assert(built.layoutMode === 'default', 'buildDefaultMobileProfile default layout');
  assert(built.compactMode === false, 'buildDefaultMobileProfile compactMode false');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
