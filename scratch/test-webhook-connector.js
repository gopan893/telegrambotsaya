'use strict';

const assert = require('assert');
const webhook = require('../src/integrations/connectors/webhook-connector');

(async () => {
  const missing = webhook.getConfig({});
  assert.equal(missing.configured, false);
  assert.ok(webhook.setupPlan(missing).missing.includes('EXTERNAL_WEBHOOK_URL'));

  const env = {
    EXTERNAL_WEBHOOK_URL: 'https://example.com/hook',
    WEBHOOK_SHARED_SECRET: 'secret'
  };
  const status = await webhook.runReadOnly('webhook.status', {}, {}, { env });
  assert.equal(status.ok, true);
  assert.equal(status.result.sharedSecretConfigured, true);
  assert.ok(!JSON.stringify(status).includes('secret'));

  const preview = await webhook.runReadOnly('webhook.payload.preview', { text: 'hello' }, {}, { env });
  assert.equal(preview.ok, true);
  assert.equal(preview.result.wouldPost, false);
  assert.equal(preview.result.valid, true);

  const plan = webhook.buildWritePlan('webhook.send', { text: 'hello' }, {});
  assert.equal(plan.ok, true);
  assert.equal(plan.requiresApproval, true);
  assert.equal(plan.dryRun.externalWriteBlocked, true);

  const rejected = webhook.buildWritePlan('webhook.send', { Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz' }, {});
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, 'WEBHOOK_PAYLOAD_SECRET_REJECTED');

  console.log('test-webhook-connector: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
