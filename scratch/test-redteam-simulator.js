'use strict';

const sim = require('../src/security/redteam-simulator');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. buildDefaultRedTeamCases returns 13 cases
const cases = sim.buildDefaultRedTeamCases();
assert(Array.isArray(cases), 'buildDefaultRedTeamCases returns array');
assertEq(cases.length, 13, 'Returns exactly 13 red-team cases');

// 2. Cases have required fields
cases.forEach((c, i) => {
  assert(c.name, `Case ${i} has name`);
  assert(c.category, `Case ${i} has category`);
  assert(c.expectedBehavior, `Case ${i} has expectedBehavior`);
  assert(c.riskLevel, `Case ${i} has riskLevel`);
});

// 3. evaluateRedTeamResult with blocked match
const r1 = sim.evaluateRedTeamResult({ expectedBehavior: 'blocked', actualBehavior: 'blocked' });
assert(r1.pass === true, 'blocked+blocked passes');

// 4. evaluateRedTeamResult with blocked mismatch
const r2 = sim.evaluateRedTeamResult({ expectedBehavior: 'blocked', actualBehavior: 'allowed' });
assert(r2.pass === false, 'blocked+allowed fails');

// 5. evaluateRedTeamResult with refused_redacted + blocked
const r3 = sim.evaluateRedTeamResult({ expectedBehavior: 'refused_redacted', actualBehavior: 'blocked' });
assert(r3.pass === true, 'refused_redacted+blocked passes');

// 6. evaluateRedTeamResult with proposal_only + blocked
const r4 = sim.evaluateRedTeamResult({ expectedBehavior: 'proposal_only', actualBehavior: 'blocked' });
assert(r4.pass === true, 'proposal_only+blocked passes');

// 7. evaluateRedTeamResult with null
const r5 = sim.evaluateRedTeamResult(null);
assert(r5.pass === false, 'Null result fails');

// 8. runRedTeamSuite returns correct structure
const suite = sim.runRedTeamSuite('full', {});
assert(typeof suite.total === 'number', 'Suite has total');
assert(typeof suite.passed === 'number', 'Suite has passed');
assert(typeof suite.failed === 'number', 'Suite has failed');
assert(typeof suite.score === 'number', 'Suite has score');
assert(Array.isArray(suite.cases), 'Suite has cases array');

// 9. Each suite case has pass boolean
suite.cases.forEach((c, i) => {
  assert(typeof c.pass === 'boolean', `Suite case ${i} has pass boolean`);
});

// 10. Score is 100 when all pass
assertEq(suite.score, 100, 'All blocked cases should score 100');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
