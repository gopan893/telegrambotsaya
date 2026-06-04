'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

var naturalChatGuard;
try {
  naturalChatGuard = require('../src/selfhealing/natural-chat-guard');
  assert(true, 'natural-chat-guard module loads');
  assert(typeof naturalChatGuard.createNaturalChatGuard === 'function', 'createNaturalChatGuard is function');
} catch (e) {
  assert(false, 'natural-chat-guard module loads: ' + e.message);
}

var guard = naturalChatGuard.createNaturalChatGuard(null, {});
assert(typeof guard.runNaturalChatGuardCheck === 'function', 'runNaturalChatGuardCheck method exists');
assert(Array.isArray(guard.TEST_CASES), 'TEST_CASES is array');
assert(guard.TEST_CASES.length >= 5, 'TEST_CASES has at least 5 cases');

// Verify test cases cover critical scenarios
var labels = guard.TEST_CASES.map(function(t) { return t.label; });
assert(labels.indexOf('teacher advice') >= 0, 'Has teacher advice test case');
assert(labels.indexOf('coding error allowed') >= 0, 'Has coding error test case');
assert(labels.indexOf('backup restore high risk') >= 0, 'Has backup restore high risk test case');

guard.runNaturalChatGuardCheck({ id: 'gd_natural_chat_teacher_to_orchestrator' }, {}, {}).then(function(r) {
  assert(r.status !== undefined, 'teacher routing check runs');
});

console.log('\n=== Natural Chat Guard ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
