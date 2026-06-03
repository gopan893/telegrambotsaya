'use strict';

const assert = require('assert');
const cloudflareNas = require('../src/integrations/connectors/cloudflare-nas-connector');

(async () => {
  const missing = cloudflareNas.getConfig({});
  assert.equal(missing.configured, false);
  assert.ok(cloudflareNas.setupPlan(missing).missing.includes('NAS_HEALTH_URL'));

  const env = {
    CLOUDFLARE_API_TOKEN: 'secret-token',
    CLOUDFLARE_ACCOUNT_ID: 'account',
    NAS_HEALTH_URL: 'https://example.com/health'
  };
  const status = await cloudflareNas.runReadOnly('cloudflare_nas.status', {}, {}, { env });
  assert.equal(status.ok, true);
  assert.equal(status.result.cloudflareTokenConfigured, true);
  assert.ok(!JSON.stringify(status).includes('secret-token'));

  const diag = await cloudflareNas.runReadOnly('nas.access.diagnose', {}, {}, { env });
  assert.equal(diag.ok, true);
  assert.ok(diag.result.diagnostics.some(item => /No mutation/.test(item)));

  const plan = cloudflareNas.buildWritePlan('cloudflare.config.change', { change: 'route NAS tunnel' }, {});
  assert.equal(plan.ok, true);
  assert.equal(plan.riskLevel, 'high');
  assert.equal(plan.dryRun.externalWriteBlocked, true);
  assert.equal(plan.dryRun.noShell, true);

  console.log('test-cloudflare-nas-connector: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
