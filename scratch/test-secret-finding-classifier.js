'use strict';

const classifier = require('../src/security/secret-finding-classifier');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. classifySecretFinding with known pattern
const f1 = classifier.classifySecretFinding({ secretType: 'TELEGRAM_TOKEN_ENV', surface: 'env' });
assert(f1 !== null, 'classifySecretFinding returns finding');
assert(f1.id, 'Finding has id');
assertEq(f1.severity, 'critical', 'TELEGRAM_TOKEN severity critical');

// 2. classifySecretFinding with null
const f2 = classifier.classifySecretFinding(null);
assertEq(f2, null, 'Null input returns null');

// 3. classifySeverity returns correct levels
assertEq(classifier.classifySeverity('TELEGRAM_TOKEN', 0.9), 'critical', 'TELEGRAM_TOKEN -> critical');
assertEq(classifier.classifySeverity('PASSWORD_VALUE', 0.9), 'high', 'PASSWORD_VALUE -> high');
assertEq(classifier.classifySeverity('UNKNOWN_TYPE', 0.9), 'medium', 'Unknown with high confidence -> medium');
assertEq(classifier.classifySeverity('UNKNOWN_TYPE', 0.5), 'low', 'Unknown with 0.5 confidence -> low');
assertEq(classifier.classifySeverity('UNKNOWN_TYPE', 0.3), 'info', 'Unknown with 0.3 confidence -> info');

// 4. estimateSecretExposureRisk returns 0-10
const risk = classifier.estimateSecretExposureRisk(f1);
assert(risk >= 0 && risk <= 10, 'Exposure risk between 0-10');

// 5. estimateSecretExposureRisk with null
assertEq(classifier.estimateSecretExposureRisk(null), 0, 'Null finding risk is 0');

// 6. buildRedactedFinding never shows secret
const redacted = classifier.buildRedactedFinding({ secretType: 'TELEGRAM_TOKEN', surface: 'env', severity: 'critical', confidence: 0.95, recommendedAction: 'rotate' });
assertEq(redacted.redactedSample, '[REDACTED]', 'Redacted finding has [REDACTED]');
assert(!redacted.id, 'Redacted finding has no id');

// 7. listFindings filtering
const findings = classifier.listFindings({ severity: 'critical' });
assert(Array.isArray(findings), 'listFindings returns array');

// 8. listFindings with limit
const limited = classifier.listFindings({ limit: 1 });
assert(limited.length <= 1, 'listFindings respects limit');

// 9. getFindingsStats
const stats = classifier.getFindingsStats();
assert(typeof stats.total === 'number', 'getFindingsStats has total');
assert(stats.bySeverity, 'getFindingsStats has bySeverity');
assert(stats.byStatus, 'getFindingsStats has byStatus');

// 10. recommendSecretFindingAction
const action = classifier.recommendSecretFindingAction(f1);
assert(typeof action === 'string' && action.length > 0, 'recommendSecretFindingAction returns string');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
