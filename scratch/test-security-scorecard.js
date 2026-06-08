'use strict';

const scorecard = require('../src/security/security-scorecard');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. calculateSecurityScorecard with no findings returns 100
const sc1 = scorecard.calculateSecurityScorecard({});
assert(typeof sc1.overallScore === 'number', 'Scorecard has overallScore');
assertEq(sc1.secretScore, 100, 'No secrets -> score 100');
assertEq(sc1.envScore, 100, 'No env issues -> score 100');
assertEq(sc1.approvalSafetyScore, 100, 'No approval findings -> score 100');

// 2. calculateSecretScore with critical findings
const secResult = { findings: [{ severity: 'critical' }, { severity: 'critical' }, { severity: 'high' }] };
const secScore = scorecard.calculateSecretScore(secResult);
assert(secScore < 100, 'Critical findings reduce secret score');
assert(secScore >= 0, 'Secret score >= 0');
assertEq(secScore, 100 - 15 - 15 - 8, 'Secret score correct penalty: 62');

// 3. calculateSecretScore with null
assertEq(scorecard.calculateSecretScore(null), 100, 'Null secret result scores 100');

// 4. calculateApprovalSafetyScore with all blocked = 100
const appOk = { findings: [{ directExecutionBlocked: true }, { directExecutionBlocked: true }] };
assertEq(scorecard.calculateApprovalSafetyScore(appOk), 100, 'All blocked -> 100');

// 5. calculateApprovalSafetyScore with not all blocked = 30
const appBad = { findings: [{ directExecutionBlocked: true }, { directExecutionBlocked: false }] };
assertEq(scorecard.calculateApprovalSafetyScore(appBad), 30, 'Not all blocked -> 30');

// 6. calculateApprovalSafetyScore with null
assertEq(scorecard.calculateApprovalSafetyScore(null), 100, 'Null approval results scores 100');

// 7. buildSecurityScoreExplanation returns formatted text
const sc2 = scorecard.calculateSecurityScorecard({});
const expl = scorecard.buildSecurityScoreExplanation(sc2);
assert(typeof expl === 'string', 'buildSecurityScoreExplanation returns string');
assert(expl.includes('Overall:'), 'Explanation includes overall score');
assert(expl.includes('Secret Score:'), 'Explanation includes secret score');
assert(expl.includes('Recommendations:'), 'Explanation includes recommendations');

// 8. buildSecurityScoreExplanation with null
assert(typeof scorecard.buildSecurityScoreExplanation(null) === 'string', 'Null scorecard returns string');

// 9. Scorecard has all required fields
assert(sc1.id, 'Scorecard has id');
assert(sc1.recommendations, 'Scorecard has recommendations');
assert(Array.isArray(sc1.recommendations), 'Recommendations is array');

// 10. calculateEnvScore with issues
const envResult = { issues: [{ severity: 'critical' }, { severity: 'high' }] };
const envScore = scorecard.calculateEnvScore(envResult);
assert(envScore < 100, 'Critical env issues reduce env score');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
