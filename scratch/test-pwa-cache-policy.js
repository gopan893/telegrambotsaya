'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // getPwaCachePolicy
  const policy = mobile.pwaCachePolicy.getPwaCachePolicy({});
  assert(policy.version === 'v1', 'cache policy version v1');
  assert(policy.cacheName === 'dashboard-cache-v1', 'cacheName is dashboard-cache-v1');
  assert(policy.strategy === 'network-first', 'strategy is network-first');
  assert(Array.isArray(policy.excludedPatterns), 'excludedPatterns is array');
  assert(policy.excludedPatterns.includes('/api/dashboard/'), 'excludes /api/dashboard/');
  assert(policy.excludedPatterns.includes('/api/auth/'), 'excludes /api/auth/');
  assert(policy.excludedPatterns.includes('/api/security/'), 'excludes /api/security/');

  // validateServiceWorkerExclusions
  const exclusions = mobile.pwaCachePolicy.validateServiceWorkerExclusions({});
  assert(exclusions.valid === true, 'SW exclusions valid');
  assert(Array.isArray(exclusions.missing), 'missing is array');
  assert(exclusions.missing.length === 0, 'no missing exclusions');

  // detectUnsafeApiCaching
  const unsafe = mobile.pwaCachePolicy.detectUnsafeApiCaching({});
  assert(typeof unsafe.unsafeCount === 'number', 'unsafeCount is number');
  assert(Array.isArray(unsafe.unsafeRoutes), 'unsafeRoutes is array');
  assert(typeof unsafe.allSafe === 'boolean', 'allSafe is boolean');

  // detectStaleDashboardCacheVersion
  const stale = mobile.pwaCachePolicy.detectStaleDashboardCacheVersion({});
  assert(stale.expected === 'dashboard-cache-v1', 'expected cache version');
  assert(stale.current === 'dashboard-cache-v1', 'current cache version matches');
  assert(stale.stale === false, 'cache is not stale');
  assert(stale.message.includes('current'), 'message says current');

  // buildPwaCachePolicyReport
  const report = mobile.pwaCachePolicy.buildPwaCachePolicyReport({});
  assert(report.policy !== undefined, 'report has policy');
  assert(report.exclusions !== undefined, 'report has exclusions');
  assert(report.unsafeCaching !== undefined, 'report has unsafeCaching');
  assert(report.versionCheck !== undefined, 'report has versionCheck');
  assert(report.summary !== undefined, 'report has summary');
  assert(typeof report.summary.exclusionsValid === 'boolean', 'summary exclusionsValid boolean');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
