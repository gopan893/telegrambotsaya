'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

// Test the natural chat guard integration with selfhealing
var selfhealing;
try {
  selfhealing = require('../src/selfhealing/index');
  assert(true, 'selfhealing index module loads');
} catch (e) {
  assert(false, 'selfhealing index module loads: ' + e.message);
}

// Check selfhealing exports
assert(typeof selfhealing.createSelfHealingSystem === 'function', 'createSelfHealingSystem exported');
assert(typeof selfhealing.createStore === 'function', 'createStore exported');
assert(typeof selfhealing.registry === 'object', 'registry exported');

// Check default guards include natural chat
var guards = selfhealing.registry.createDefaultGuards();
var natChatGuard = guards.find(function(g) { return g.category === 'natural_chat'; });
assert(!!natChatGuard, 'default guards include natural_chat category');
assert(natChatGuard.id === 'gd_natural_chat_teacher_to_orchestrator' || natChatGuard.id === 'gd_natural_chat_no_raw_debug', 'natural chat guard has correct id');

// Verify guard model
var guard = guards[0];
assert(!!guard.id, 'guard has id');
assert(!!guard.name, 'guard has name');
assert(!!guard.category, 'guard has category');
assert(!!guard.severity, 'guard has severity');
assert(typeof guard.enabled === 'boolean', 'guard has enabled flag');
assert(!!guard.checkType, 'guard has checkType');
assert(!!guard.failureMessage, 'guard has failureMessage');
assert(!!guard.suggestedRepair, 'guard has suggestedRepair');

// Test guard categories
selfhealing.registry.CATEGORIES.forEach(function(cat) {
  assert(guards.some(function(g) { return g.category === cat; }) || cat === 'pwa', 'category ' + cat + ' has at least one guard');
});

console.log('\n=== Self-Healing Natural Chat Integration ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
