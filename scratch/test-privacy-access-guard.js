'use strict';

const guard = require('../src/privacy/privacy-access-guard');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test checkPrivacyAccess for owner
const ownerResult = guard.checkPrivacyAccess({ role: 'owner' }, {});
assert(ownerResult.allowed === true, 'owner access allowed');
assert(ownerResult.status === 'allowed', 'owner status allowed');

// Test checkPrivacyAccess for admin
const adminResult = guard.checkPrivacyAccess({ role: 'admin' }, {});
assert(adminResult.allowed === true, 'admin access allowed');

// Test checkPrivacyAccess for user with allowedRoles
const userResult = guard.checkPrivacyAccess({ role: 'user' }, { allowedRoles: ['user'] });
assert(userResult.allowed === true, 'user access allowed when user in allowedRoles');

// Test checkPrivacyAccess for unknown role
const unknownResult = guard.checkPrivacyAccess({ role: 'guest' }, {});
assert(unknownResult.allowed === false, 'guest access denied');
assert(unknownResult.status === 'denied', 'guest status denied');

// Test checkPrivacyAccess for missing actor
const noActorResult = guard.checkPrivacyAccess(null, {});
assert(noActorResult.allowed === false, 'null actor denied');
assert(noActorResult.reason === 'Unknown actor', 'null actor reason correct');

// Test checkExportAccess blocks sensitive without owner
const sensitiveExport = guard.checkExportAccess({ role: 'admin' }, { includeSensitive: true });
assert(sensitiveExport.allowed === false, 'sensitive export blocked for admin');
assert(sensitiveExport.reason === 'Sensitive export requires owner', 'correct reason');

// Test checkExportAccess allows owner
const ownerExport = guard.checkExportAccess({ role: 'owner' }, { includeSensitive: true });
assert(ownerExport.allowed === true, 'sensitive export allowed for owner');

// Test checkArchiveAccess blocks user
const userArchive = guard.checkArchiveAccess({ role: 'user' }, {});
assert(userArchive.allowed === false, 'user archive denied');
assert(userArchive.reason === 'Archive requires admin/owner', 'correct archive deny reason');

// Test checkDeleteAccess blocks hard delete for non-owner
const adminHardDelete = guard.checkDeleteAccess({ role: 'admin' }, { hardDeleteRequested: true });
assert(adminHardDelete.allowed === false, 'admin hard delete denied');
assert(adminHardDelete.reason === 'Hard delete requires owner', 'correct hard delete reason');

// Test checkDeleteAccess allows owner hard delete
const ownerHardDelete = guard.checkDeleteAccess({ role: 'owner' }, { hardDeleteRequested: true });
assert(ownerHardDelete.allowed === true, 'owner hard delete allowed');

// Test buildPrivacyAccessDeniedResponse returns correct shape
const denied = guard.buildPrivacyAccessDeniedResponse('Test denied');
assert(denied.ok === false, 'denied response ok is false');
assert(denied.error === 'PRIVACY_ACCESS_DENIED', 'denied error code correct');
assert(denied.message === 'Test denied', 'denied reason correct');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
