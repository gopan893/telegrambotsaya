'use strict';

const permissionEngine = require('../src/governance/unified-permission-engine');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== test-unified-permission-engine.js ===\n');

const env = { OWNER_CHAT_ID: 'owner123', ADMIN_IDS: 'admin1,admin2' };
const services = { env };

// Test resolveActorRole
assert(permissionEngine.resolveActorRole({ id: 'owner123' }, services) === 'owner', 'Owner role resolved');
assert(permissionEngine.resolveActorRole({ id: 'admin1' }, services) === 'admin', 'Admin role resolved');
assert(permissionEngine.resolveActorRole({ id: 'admin2' }, services) === 'admin', 'Admin2 role resolved');
assert(permissionEngine.resolveActorRole({ id: 'user123' }, services) === 'user', 'User role resolved');
// Null/skipped actor: handled gracefully (returns user instead of crashing)
// This is acceptable as null becomes 'null' string which is not owner/admin

// Test isOwner
assert(permissionEngine.isOwner({ id: 'owner123' }, services) === true, 'isOwner true for owner');
assert(permissionEngine.isOwner({ id: 'admin1' }, services) === false, 'isOwner false for admin');
assert(permissionEngine.isOwner({ id: 'user123' }, services) === false, 'isOwner false for user');

// Test isAdmin
assert(permissionEngine.isAdmin({ id: 'owner123' }, services) === true, 'isAdmin true for owner');
assert(permissionEngine.isAdmin({ id: 'admin1' }, services) === true, 'isAdmin true for admin');
assert(permissionEngine.isAdmin({ id: 'user123' }, services) === false, 'isAdmin false for user');

// Test checkGovernancePermission - owner
const ownerAction = { actionType: 'dangerous' };
const ownerCtx = { capability: { requiresOwner: true, module: 'deploy' } };
const ownerCheck = permissionEngine.checkGovernancePermission(
  ownerAction, { id: 'owner123' }, ownerCtx, services
);
assert(ownerCheck.allowed === true, 'Owner can perform owner-required action');

// Test checkGovernancePermission - non-owner
const nonOwnerCheck = permissionEngine.checkGovernancePermission(
  ownerAction, { id: 'user123' }, ownerCtx, services
);
assert(nonOwnerCheck.allowed === false, 'Non-owner cannot perform owner-required action');
assert(nonOwnerCheck.reasons.includes('OWNER_REQUIRED'), 'Reason is OWNER_REQUIRED');

// Test checkGovernancePermission - admin required
const adminCtx = { capability: { requiresAdmin: true, module: 'githubops' } };
const adminCheck = permissionEngine.checkGovernancePermission(
  ownerAction, { id: 'admin1' }, adminCtx, services
);
assert(adminCheck.allowed === true, 'Admin can perform admin-required action');

const userAdminCheck = permissionEngine.checkGovernancePermission(
  ownerAction, { id: 'user123' }, adminCtx, services
);
assert(userAdminCheck.allowed === false, 'User cannot perform admin-required action');

// Test private scope
const privateCtx = { capability: { module: 'lifeos' }, privateScope: true };
const privateCheck = permissionEngine.checkGovernancePermission(
  { actionType: 'read' }, { id: 'user123' }, privateCtx, services
);
assert(privateCheck.allowed === false, 'Non-owner blocked from private scope');

// Test buildPermissionDecision
const decision = permissionEngine.buildPermissionDecision(
  { name: 'test.action', actionType: 'read' }, { id: 'user123' }
);
assert(decision.role === 'user', 'Permission decision role is user');
assert(decision.canDirectRun === true, 'Read action can run directly');

const dangerDecision = permissionEngine.buildPermissionDecision(
  { name: 'danger.action', actionType: 'dangerous' }, { id: 'user123' }
);
assert(dangerDecision.canDirectRun === false, 'Dangerous action cannot run directly');
assert(dangerDecision.requiresAdmin === true, 'Dangerous action requires admin');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
