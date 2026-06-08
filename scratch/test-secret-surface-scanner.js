'use strict';

const scanner = require('../src/security/secret-surface-scanner');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. scanTextForSecrets with TELEGRAM_TOKEN env var name
const r1 = scanner.scanTextForSecrets('export TELEGRAM_TOKEN=123', 'env', 'test.sh');
assert(r1.length > 0, 'Should detect TELEGRAM_TOKEN env');
assert(r1.some(f => f.secretType === 'TELEGRAM_TOKEN_ENV'), 'Should label TELEGRAM_TOKEN_ENV');
assert(r1[0].severity === 'critical', 'TELEGRAM_TOKEN severity critical');

// 2. scanTextForSecrets with github_pat
const r2 = scanner.scanTextForSecrets('github_pat_abcdefghijklmnopqrstuvwxyz', 'code');
assert(r2.some(f => f.secretType === 'GITHUB_TOKEN_PAT'), 'Should detect github_pat');

// 3. scanTextForSecrets with password=
const r3 = scanner.scanTextForSecrets('password=supersecret', 'config');
assert(r3.some(f => f.secretType === 'PASSWORD_VALUE'), 'Should detect password=');

// 4. scanTextForSecrets with null text
const r4 = scanner.scanTextForSecrets(null, 'test');
assertEq(r4.length, 0, 'Null text returns empty array');

// 5. scanTextForSecrets with Bearer token
const r5 = scanner.scanTextForSecrets('Authorization: Bearer xyz123abc', 'header');
assert(r5.some(f => f.secretType === 'BEARER_TOKEN'), 'Should detect Bearer token');

// 6. findSecretsInObject with nested object
const r6 = scanner.findSecretsInObject({ env: { DATABASE_URL: 'postgresql://user:pass@host/db' } }, 'env');
assert(r6.length > 0, 'findSecretsInObject finds nested secrets');
assert(r6.some(f => f.secretType === 'POSTGRESQL_URL'), 'Should detect POSTGRESQL_URL');

// 7. findSecretsInObject with null
const r7 = scanner.findSecretsInObject(null, 'test');
assertEq(r7.length, 0, 'findSecretsInObject(null) returns empty');

// 8. scanAuditLogsForSecrets returns empty or degraded
const r8a = scanner.scanAuditLogsForSecrets({});
assert(Array.isArray(r8a), 'scanAuditLogsForSecrets returns array');
const r8b = scanner.scanAuditLogsForSecrets({ governanceAudit: { listAuditEvents: null } });
assert(r8b.length === 0 || r8b[0].secretType === 'SCAN_ERROR', 'scanAuditLogsForSecrets handles null listAuditEvents');

// 9. buildSecretSurfaceScanReport aggregates correctly
const report = scanner.buildSecretSurfaceScanReport([r1, r2, r3]);
assertEq(typeof report.totalFindings, 'number', 'Report has totalFindings');
assertEq(typeof report.totalCritical, 'number', 'Report has totalCritical');
assert(Array.isArray(report.bySurface), 'Report bySurface is array');
assert(Array.isArray(report.findings), 'Report findings is array');
assert(report.bySeverity.critical >= 0, 'bySeverity has critical count');

// 10. redactedSample is properly truncated
assert(r1[0].redactedSample.length <= 10, 'Redacted sample is short');
assert(r1[0].redactedSample.includes('****'), 'Redacted sample contains mask');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
