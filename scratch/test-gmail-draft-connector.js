'use strict';

const assert = require('assert');
const gmail = require('../src/integrations/connectors/gmail-draft-connector');

(async () => {
  const env = {
    GOOGLE_CLIENT_ID: 'client',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REDIRECT_URI: 'https://example.com/oauth'
  };
  const status = await gmail.runReadOnly('gmail.status', {}, {}, { env });
  assert.equal(status.ok, true);
  assert.equal(status.result.draftOnly, true);
  assert.equal(status.result.sendEnabled, false);
  assert.ok(!JSON.stringify(status).includes('secret'));

  const draft = gmail.buildWritePlan('gmail.draft.create', {
    to: 'team@example.com',
    subject: 'Progress',
    body: 'Update project'
  }, {});
  assert.equal(draft.ok, true);
  assert.equal(draft.requiresApproval, true);
  assert.equal(draft.dryRun.draftOnly, true);
  assert.equal(draft.dryRun.externalWriteBlocked, true);

  const send = gmail.buildWritePlan('gmail.send', { to: 'team@example.com' }, {});
  assert.equal(send.ok, false);
  assert.equal(send.error, 'GMAIL_SEND_DISABLED');
  assert.equal(gmail.actionMetadata('gmail.send').riskLevel, 'danger');

  console.log('test-gmail-draft-connector: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
