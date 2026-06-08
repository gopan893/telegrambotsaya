'use strict';

const auditor = require('../src/security/capability-risk-auditor');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. auditDangerousCapabilities with null governance
const r1 = auditor.auditDangerousCapabilities({ governance: null });
assert(Array.isArray(r1), 'auditDangerousCapabilities returns array');
assert(r1.some(f => f.capability === 'all'), 'Null governance returns all cap issue');
assertEq(r1[0].severity, 'high', 'Null governance is high severity');

// 2. auditDangerousCapabilities with no governance object
const r2 = auditor.auditDangerousCapabilities({});
assert(r2.some(f => f.capability === 'all'), 'No governance returns all cap issue');

// 3. auditExternalWriteCapabilities with null governance
const r3 = auditor.auditExternalWriteCapabilities({ governance: null });
assert(Array.isArray(r3), 'auditExternalWriteCapabilities returns array');
assert(r3.some(f => f.capability === 'all'), 'Null governance returns all cap issue');

// 4. auditExternalWriteCapabilities with no governance
const r4 = auditor.auditExternalWriteCapabilities({});
assert(r4.some(f => f.capability === 'all'), 'No governance returns all cap issue');

// 5. buildCapabilityRiskReport correct format
const report = auditor.buildCapabilityRiskReport([r1, r2]);
assert(typeof report.totalFindings === 'number', 'Report has totalFindings');
assert(typeof report.totalCritical === 'number', 'Report has totalCritical');
assert(report.bySeverity, 'Report has bySeverity');
assert(Array.isArray(report.findings), 'Report findings is array');

// 6. DANGEROUS_ACTIONS and EXTERNAL_WRITE_ACTIONS exported
assert(Array.isArray(auditor.DANGEROUS_ACTIONS), 'DANGEROUS_ACTIONS is array');
assert(auditor.DANGEROUS_ACTIONS.length > 0, 'DANGEROUS_ACTIONS not empty');
assert(Array.isArray(auditor.EXTERNAL_WRITE_ACTIONS), 'EXTERNAL_WRITE_ACTIONS is array');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
