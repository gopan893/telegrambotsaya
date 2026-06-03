'use strict';

const assert = require('assert');
const github = require('../src/integrations/connectors/github-connector');

(async () => {
  const missing = github.getConfig({});
  assert.equal(missing.configured, false);
  assert.deepEqual(github.setupPlan(missing).missing, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);

  const configured = github.getConfig({ GITHUB_TOKEN: 'ghp_secretshouldnotleak', GITHUB_OWNER: 'afan', GITHUB_REPO: 'bot' });
  assert.equal(configured.configured, true);
  assert.equal(configured.tokenConfigured, true);

  const status = await github.runReadOnly('github.status', {}, {}, { env: { GITHUB_TOKEN: 'ghp_secretshouldnotleak', GITHUB_OWNER: 'afan', GITHUB_REPO: 'bot' } });
  assert.equal(status.ok, true);
  assert.equal(status.result.tokenConfigured, true);
  assert.ok(!JSON.stringify(status).includes('ghp_secretshouldnotleak'));

  const plan = github.buildWritePlan('github.issue.create', {
    title: 'Deploy bug',
    body: 'Render deploy fails'
  }, {});
  assert.equal(plan.ok, true);
  assert.equal(plan.requiresApproval, true);
  assert.equal(plan.dryRun.externalWriteBlocked, true);
  assert.equal(github.actionMetadata('github.issues.list').readOnly, true);
  assert.equal(github.actionMetadata('github.issue.create').requiresApproval, true);

  console.log('test-github-connector: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
