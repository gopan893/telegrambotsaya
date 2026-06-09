'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // getPwaOfflineStatus
  const status = mobile.pwaOfflineController.getPwaOfflineStatus({});
  assert(status.online === true, 'offline status online is true');
  assert(status.cacheReady === true, 'cacheReady is true');
  assert(status.offlineMode === false, 'offlineMode is false');
  assert(typeof status.lastSync === 'string', 'lastSync is a string');

  // buildOfflineShellManifest
  const manifest = mobile.pwaOfflineController.buildOfflineShellManifest({});
  assert(manifest.length >= 8, 'shell manifest has at least 8 entries');
  assert(manifest.includes('/dashboard/index.html'), 'manifest includes index.html');
  assert(manifest.includes('/dashboard/styles.css'), 'manifest includes styles.css');

  // validateOfflineCachePolicy
  const cachePolicy = mobile.pwaOfflineController.validateOfflineCachePolicy({});
  assert(typeof cachePolicy.valid === 'boolean', 'cachePolicy has valid boolean');
  assert(typeof cachePolicy.issues !== 'undefined', 'cachePolicy has issues array');
  assert(typeof cachePolicy.safe !== 'undefined', 'cachePolicy has safe array');

  // explainOfflineLimitations
  const limitations = mobile.pwaOfflineController.explainOfflineLimitations({});
  assert(Array.isArray(limitations.worksOffline), 'worksOffline is array');
  assert(Array.isArray(limitations.doesNotWorkOffline), 'doesNotWorkOffline is array');
  assert(limitations.worksOffline.length >= 4, 'worksOffline has at least 4 items');
  assert(limitations.doesNotWorkOffline.length >= 4, 'doesNotWorkOffline has at least 4 items');
  assert(limitations.warning.includes('offline'), 'warning mentions offline');
  assert(limitations.doesNotWorkOffline.some(i => i.includes('/api/dashboard')), 'doesNotWorkOffline mentions api/dashboard');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
