'use strict';

const drift = require('../src/security/env-drift-detector');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. detectEnvDrift returns array
const r1 = drift.detectEnvDrift({ env: {} });
assert(Array.isArray(r1), 'detectEnvDrift returns array');
assert(r1.length > 0, 'Empty env produces drift results');

// 2. detectDangerousEnvFlags catches AUTO_APPROVE_ENABLED=true
const danger1 = drift.detectDangerousEnvFlags({ AUTO_APPROVE_ENABLED: 'true' });
assert(danger1.some(d => d.envName === 'AUTO_APPROVE_ENABLED'), 'detectDangerousEnvFlags catches AUTO_APPROVE_ENABLED');

// 3. detectDangerousEnvFlags catches missing DASHBOARD_ADMIN_TOKEN
const danger2 = drift.detectDangerousEnvFlags({});
assert(danger2.some(d => d.envName === 'DASHBOARD_ADMIN_TOKEN'), 'detectDangerousEnvFlags flags missing DASHBOARD_ADMIN_TOKEN');

// 4. detectDangerousEnvFlags catches AUTO_RUN_ENABLED
const danger3 = drift.detectDangerousEnvFlags({ AUTO_RUN_ENABLED: 'true' });
assert(danger3.some(d => d.envName === 'AUTO_RUN_ENABLED'), 'detectDangerousEnvFlags catches AUTO_RUN_ENABLED');

// 5. detectDangerousEnvFlags catches SHELL_EXECUTOR_ENABLED
const danger4 = drift.detectDangerousEnvFlags({ SHELL_EXECUTOR_ENABLED: 'true' });
assert(danger4.some(d => d.envName === 'SHELL_EXECUTOR_ENABLED'), 'detectDangerousEnvFlags catches SHELL_EXECUTOR_ENABLED');

// 6. detectCommonEnvTypos catches TELEGRAM_TOKEN_PLANNE
const typo1 = drift.detectCommonEnvTypos({ TELEGRAM_TOKEN_PLANNE: 'something' });
assert(typo1.some(d => d.envName === 'TELEGRAM_TOKEN_PLANNE'), 'detectCommonEnvTypos catches TELEGRAM_TOKEN_PLANNE');

// 7. detectCommonEnvTypos catches DATBASE_URL
const typo2 = drift.detectCommonEnvTypos({ DATBASE_URL: 'something' });
assert(typo2.some(d => d.envName === 'DATBASE_URL'), 'detectCommonEnvTypos catches DATBASE_URL');

// 8. detectCommonEnvTypos catches GITHUB_TOKN
const typo3 = drift.detectCommonEnvTypos({ GITHUB_TOKN: 'x' });
assert(typo3.some(d => d.envName === 'GITHUB_TOKN'), 'detectCommonEnvTypos catches GITHUB_TOKN');

// 9. buildEnvDriftReport correctly aggregates
const report = drift.buildEnvDriftReport(r1);
assert(typeof report.totalIssues === 'number', 'Report has totalIssues');
assert(typeof report.totalCritical === 'number', 'Report has totalCritical');
assert(Array.isArray(report.byCategory), 'Report byCategory is array');
assert(Array.isArray(report.issues), 'Report issues is array');
assert(report.bySeverity, 'Report has bySeverity');

// 10. detectEnvDrift with full env
const r2 = drift.detectEnvDrift({ env: { NODE_ENV: 'production', PORT: '3000', WEBHOOK_URL: 'https://example.com', TELEGRAM_TOKEN: 'x', OWNER_CHAT_ID: '123', ADMIN_IDS: '123', DASHBOARD_ADMIN_TOKEN: 'x', STORAGE_DRIVER: 'postgres', DATABASE_URL: 'x', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'x' } });
assert(Array.isArray(r2), 'Full env still returns array');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
