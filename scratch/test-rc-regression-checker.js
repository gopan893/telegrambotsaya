'use strict';

const RcRegressionChecker = require('../src/release/rc-regression-checker');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('\n=== RC Regression Checker Tests ===\n');

// 1. checkDashboardRegistryRegression
const reg = RcRegressionChecker.checkDashboardRegistryRegression({});
assert(reg.pass === true, 'dashboard registry regression pass');
assert(reg.tabCount >= 40, 'registry has >= 40 tabs');

// 2. checkDashboardSidebarRegression
const side = RcRegressionChecker.checkDashboardSidebarRegression({});
assert(side.pass === true, 'dashboard sidebar regression pass');
assert(side.tabCount >= 40, 'sidebar has >= 40 tabs');

// 3. checkDashboardRendererRegression
const rend = RcRegressionChecker.checkDashboardRendererRegression({});
assert(rend.pass === true, 'dashboard renderer regression pass');
assert(rend.rendererCount >= 40, 'renderer count >= 40');

// 4. checkPwaCacheRegression
const pwa = RcRegressionChecker.checkPwaCacheRegression({});
assert(pwa.pass === true, 'pwa cache regression pass');

// 5. checkTelegramCommandRegression
const tg = RcRegressionChecker.checkTelegramCommandRegression({});
assert(tg.pass === true, 'telegram command regression pass');

// 6. checkNaturalRouterRegression
const nat = RcRegressionChecker.checkNaturalRouterRegression({});
assert(nat.pass === true, 'natural router regression pass');

// 7. checkApprovalBoundaryRegression
const app = RcRegressionChecker.checkApprovalBoundaryRegression({});
assert(app.pass === true, 'approval boundary regression pass');
assert(app.findings.length >= 13 * 4, 'approval checks for 13 actions x 4 assertions');

// 8. checkSecretRedactionRegression
const sec = RcRegressionChecker.checkSecretRedactionRegression({});
assert(sec.pass === true, 'secret redaction regression pass');

// 9. checkPrivacyExportRegression
const priv = RcRegressionChecker.checkPrivacyExportRegression({});
assert(priv.pass === true, 'privacy export regression pass');

// 10. checkReleaseCandidateRegression
const rel = RcRegressionChecker.checkReleaseCandidateRegression({});
assert(rel.pass === true, 'release candidate regression pass');
assert(rel.findings.length >= 13, 'release candidate has >= 13 checks');

console.log(`\nResult: ${passed} PASS, ${failed} FAIL\n`);
process.exit(failed > 0 ? 1 : 0);
