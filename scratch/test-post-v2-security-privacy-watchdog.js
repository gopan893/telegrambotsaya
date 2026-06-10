'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Post-V2 Security/Privacy Watchdog ===\n');

  const sw = require(path.join(ROOT, 'src/post-v2/post-v2-security-privacy-watchdog'));

  const redactChecks = sw.checkSecretRedactionPostV2({ sampleOutputs: ['TELEGRAM_TOKEN=12345', 'normal output', 'DATABASE_URL=postgres://user:pass@host/db'] });
  check(Array.isArray(redactChecks), 'checkSecretRedactionPostV2 returns array');
  check(redactChecks.length > 0, 'checkSecretRedactionPostV2 returns checks');

  const envLeaks = sw.checkEnvValueLeakPostV2({ envValues: { TELEGRAM_TOKEN: '[REDACTED]', DATABASE_URL: 'exposed_value' } });
  check(Array.isArray(envLeaks), 'checkEnvValueLeakPostV2 returns array');

  const bypassIssues = sw.checkApprovalBypassPostV2({ approvalBypassPaths: ['/api/admin/delete', '/api/dashboard/post-v2/start'] });
  check(Array.isArray(bypassIssues), 'checkApprovalBypassPostV2 returns array');

  const report = sw.buildSecurityPrivacyWatchdogReport({ sampleOutputs: ['ok'], envValues: {}, approvalBypassPaths: [] });
  check(report.module === 'security_privacy', 'buildSecurityPrivacyWatchdogReport returns module name');
  check(typeof report.passed === 'boolean', 'buildSecurityPrivacyWatchdogReport returns passed');
  check(report.noSecrets === true, 'buildSecurityPrivacyWatchdogReport has noSecrets flag');

  console.log('\n=== Security/Privacy Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
