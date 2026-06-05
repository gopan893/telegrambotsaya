'use strict';

const monitor = require('../src/deploy/post-deploy-monitor');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- post-deploy-monitor ---');
const report = monitor.runPostDeployChecks('dp-1', {});
assert(report.ok === true, 'post-deploy checks pass');
assert(report.deployPlanId === 'dp-1', 'deployPlanId preserved');
assert(report.checks.healthEndpoint.ok === true, 'health check ok');
assert(report.checks.dashboardReachability.ok === true, 'dashboard check ok');
assert(report.checks.storageHealth.ok === true, 'storage check ok');
assert(report.checks.redisHealth.ok === true, 'redis check ok');
assert(report.checks.executorBoundary.ok === true, 'executor boundary ok');
assert(report.checks.integrationGate.ok === true, 'integration gate ok');

const reportWithRedis = monitor.runPostDeployChecks('dp-2', { env: { REDIS_URL: 'redis://x' } });
assert(reportWithRedis.checks.redisHealth.note.includes('Redis configured'), 'redis note when configured');

const built = monitor.buildPostDeployReport(null);
assert(built.ok === false, 'buildPostDeployReport null returns error');

const built2 = monitor.buildPostDeployReport(report);
assert(built2.ok === true, 'buildPostDeployReport with data ok');

const webhook = monitor.checkTelegramWebhookStatus();
assert(webhook.ok === true, 'webhook status ok');

const tabs = monitor.checkDashboardTabsHealth();
assert(tabs.ok === true, 'tabs health ok');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
