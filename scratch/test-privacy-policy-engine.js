'use strict';

const pp = require('../src/privacy/privacy-policy-engine');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test getPrivacyPolicy returns default for unknown category
const unknownPolicy = pp.getPrivacyPolicy('nonexistent_category');
assert(unknownPolicy.allowedRoles.includes('user'), 'unknown category default includes user');
assert(unknownPolicy.allowExport === true, 'unknown category default allowExport is true');

// Test getPrivacyPolicy returns specific defaults for known categories
const moodPolicy = pp.getPrivacyPolicy('lifeos_mood_energy');
assert(moodPolicy.ownerOnly === true, 'lifeos_mood_energy ownerOnly is true');
assert(moodPolicy.allowedRoles.length === 1 && moodPolicy.allowedRoles[0] === 'owner', 'lifeos_mood_energy only owner role');
assert(moodPolicy.allowDashboardAccess === false, 'lifeos_mood_energy allowDashboardAccess is false');

const msgPolicy = pp.getPrivacyPolicy('telegram_messages');
assert(msgPolicy.allowedRoles.includes('admin'), 'telegram_messages includes admin role');
assert(msgPolicy.allowAgentAccess === true, 'telegram_messages allowAgentAccess is true');

// Test updatePrivacyPolicy creates new policy
const newPolicy = pp.updatePrivacyPolicy({ dataCategory: 'test_category', allowedRoles: ['owner'] });
assert(newPolicy.id, 'updatePrivacyPolicy creates id');
assert(newPolicy.dataCategory === 'test_category', 'new policy has correct category');
assert(newPolicy.createdAt, 'new policy has createdAt');

// Test evaluatePrivacyAccess blocks non-owner for owner-only data
const ownerOnlyResult = pp.evaluatePrivacyAccess({ actor: { role: 'admin' }, dataCategory: 'lifeos_mood_energy', action: 'view' });
assert(ownerOnlyResult.allowed === false, 'admin blocked for owner-only data');
assert(ownerOnlyResult.reason === 'Owner-only data', 'correct reason for owner-only block');

// Test evaluatePrivacyAccess allows owner
const ownerResult = pp.evaluatePrivacyAccess({ actor: { role: 'owner' }, dataCategory: 'lifeos_mood_energy', action: 'view' });
assert(ownerResult.allowed === true, 'owner allowed for owner-only data');

// Test evaluatePrivacyAccess blocks export when not allowed
const blockedExport = pp.evaluatePrivacyAccess({ actor: { role: 'owner' }, dataCategory: 'lifeos_mood_energy', action: 'export' });
assert(blockedExport.allowed === false, 'export blocked for non-exportable category');

// Test evaluatePrivacyAccess allows valid access
const validAccess = pp.evaluatePrivacyAccess({ actor: { role: 'admin' }, dataCategory: 'telegram_messages', action: 'view' });
assert(validAccess.allowed === true, 'admin allowed for telegram_messages');

// Test buildPrivacyDecision correct format
const decision = pp.buildPrivacyDecision({ actor: { role: 'owner' }, dataCategory: 'telegram_messages', action: 'view' });
assert(decision.request, 'decision has request');
assert(decision.request.actor === 'owner', 'decision request actor is correct');
assert(decision.allowed === true, 'decision allowed is true');
assert(decision.timestamp, 'decision has timestamp');

// Test listPolicies
const policies = pp.listPolicies();
assert(Array.isArray(policies), 'listPolicies returns array');
assert(policies.length >= 1, 'has at least one policy after update');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
