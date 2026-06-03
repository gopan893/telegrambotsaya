'use strict';

const assert = require('assert');
const calendar = require('../src/integrations/connectors/google-calendar-connector');

(async () => {
  const missing = calendar.getConfig({});
  assert.equal(missing.configured, false);
  assert.ok(calendar.setupPlan(missing).missing.includes('GOOGLE_CLIENT_ID'));

  const env = {
    GOOGLE_CLIENT_ID: 'client',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REDIRECT_URI: 'https://example.com/oauth'
  };
  const status = await calendar.runReadOnly('calendar.status', {}, {}, { env });
  assert.equal(status.ok, true);
  assert.equal(status.result.configured, true);
  assert.ok(!JSON.stringify(status).includes('secret'));

  const unauthEvents = await calendar.runReadOnly('calendar.events.list', {}, { userId: 'owner' }, {
    env,
    getCalendarClient: async () => ({})
  });
  assert.equal(unauthEvents.ok, true);
  assert.equal(unauthEvents.result.status, 'user_auth_required');

  const plan = calendar.buildWritePlan('calendar.event.create', {
    summary: 'Planning meeting',
    start: '2026-06-04T09:00:00+09:00'
  }, {});
  assert.equal(plan.ok, true);
  assert.equal(plan.requiresApproval, true);
  assert.equal(plan.dryRun.externalWriteBlocked, true);
  assert.equal(calendar.actionMetadata('calendar.events.list').readOnly, true);

  console.log('test-google-calendar-connector: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
