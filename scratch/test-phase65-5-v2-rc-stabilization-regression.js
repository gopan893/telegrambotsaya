'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const SCRATCH = __dirname;
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const cpCert = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-control-panel-certifier'));
  const regCert = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-registry-certifier'));
  const boundCert = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-boundary-certifier'));
  const perfCert = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-performance-certifier'));
  const secCert = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-security-privacy-certifier'));
  const safeCert = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-safety-boundary-certifier'));
  const auditor = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-auditor'));
  const blocker = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-blocker-classifier'));
  const fixPolicy = require(path.join(ROOT, 'src/v2-stabilization/v2-rc-p0-p1-fix-policy'));

  check(typeof cpCert.certifyV2RcControlPanel === 'function', 'Control panel certifier loaded');
  check(typeof regCert.certifyV2RcRegistryV2 === 'function', 'Registry v2 certifier loaded');
  check(typeof boundCert.certifyV2RcBoundary === 'function', 'Boundary certifier loaded');
  check(typeof perfCert.certifyV2RcPerformance === 'function', 'Performance certifier loaded');
  check(typeof secCert.certifyV2RcSecurityPrivacy === 'function', 'Security/privacy certifier loaded');
  check(typeof safeCert.certifyV2RcSafetyBoundary === 'function', 'Safety boundary certifier loaded');

  const certResults = await Promise.all([
    cpCert.certifyV2RcControlPanel(),
    regCert.certifyV2RcRegistryV2(),
    boundCert.certifyV2RcBoundary(),
    perfCert.certifyV2RcPerformance(),
    secCert.certifyV2RcSecurityPrivacy(),
    safeCert.certifyV2RcSafetyBoundary()
  ]);
  check(certResults.every(r => typeof r.passed === 'boolean'), 'All certifiers return passed boolean');
  check(certResults.every(r => Array.isArray(r.checks)), 'All certifiers return checks array');

  const auditResult = await auditor.runV2RcAudit();
  check(!!auditResult, 'Auditor runs successfully');
  check(!!auditResult.id, 'Audit returns id');

  const findings = [
    { severity: 'P0', message: 'Release blocker test', category: 'test' },
    { severity: 'P1', message: 'Must fix test', category: 'test' }
  ];
  const blockerSummary = blocker.buildBlockerSummary(findings);
  check(blockerSummary.p0 === 1, 'Blocker classifier classifies P0');
  check(blockerSummary.p1 === 1, 'Blocker classifier classifies P1');

  const fixResult = fixPolicy.allowOnlyP0P1Fix({ type: 'syntax-error-fix', description: 'Fix test' });
  check(fixResult.allowed === true, 'Fix policy allows P0/P1 fix');

  const fixReport = fixPolicy.buildAllowedFixPolicyReport();
  check(Array.isArray(fixReport.allowed), 'Fix policy report has allowed fixes');
  check(Array.isArray(fixReport.blocked), 'Fix policy report has blocked changes');

  const routeFile = path.join(ROOT, 'src/dashboard/v2-stabilization-routes.js');
  check(fs.existsSync(routeFile), 'v2-stabilization-routes.js exists');

  const dashFile = path.join(ROOT, 'public/dashboard/v2-stabilization.js');
  check(fs.existsSync(dashFile), 'v2-stabilization dashboard JS exists');

  const certifierFiles = [
    'v2-rc-control-panel-certifier.js',
    'v2-rc-registry-certifier.js',
    'v2-rc-boundary-certifier.js',
    'v2-rc-performance-certifier.js',
    'v2-rc-security-privacy-certifier.js',
    'v2-rc-safety-boundary-certifier.js'
  ];
  for (const f of certifierFiles) {
    check(fs.existsSync(path.join(ROOT, 'src/v2-stabilization', f)), 'Certifier exists: ' + f);
  }

  try {
    execSync('node --check "' + routeFile + '"', { stdio: 'pipe' });
    check(true, 'Route file passes syntax check');
  } catch (e) {
    check(false, 'Route file syntax check: ' + (e.stderr || '').toString());
  }

  try {
    execSync('node --check "' + dashFile + '"', { stdio: 'pipe' });
    check(true, 'Dashboard JS file passes syntax check');
  } catch (e) {
    check(false, 'Dashboard JS file syntax check: ' + (e.stderr || '').toString());
  }

  console.log('\n=== Phase 65.5 V2 RC Stabilization Regression: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) {
      console.error('  FAILED: ' + f);
    }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
