'use strict';

const assert = require('assert');
const registry = require('../src/cicd/github-actions-registry');
const status = require('../src/cicd/github-actions-status');
const { createGithubActionsProposal } = require('../src/cicd/github-actions-proposal');

async function run() {
  const workflows = registry.listRegisteredWorkflows();
  assert(workflows.some(item => item.id === 'ci.yml'), 'ci workflow registered');
  assert(workflows.some(item => item.id === 'release-check.yml'), 'release workflow registered');
  assert.strictEqual(registry.getWorkflow('dashboard-regression.yml').path, '.github/workflows/dashboard-regression.yml', 'dashboard workflow lookup');

  const missing = await status.getGithubActionsStatus({ env: {} });
  assert.strictEqual(missing.ok, false, 'missing GitHub token returns setup plan');
  assert(!JSON.stringify(missing).includes('ghp_'), 'missing status has no token leak');

  const ready = await status.getGithubActionsStatus({ env: { GITHUB_TOKEN: 'redacted-test-token' } });
  assert.strictEqual(ready.ok, true, 'configured GitHub status is read-only available');
  assert.strictEqual(ready.readonly, true, 'status is read-only');

  const store = { proposals: [], async saveProposal(item) { this.proposals.push(item); return item; } };
  const evalSystem = { async runEvalCases() { return { cicdSafetyScore: 100, deployApprovalBoundaryScore: 100 }; } };
  const executorSystem = { async createProposal(input) { return { id: 'exec_test', ...input }; } };
  const proposal = createGithubActionsProposal(store, evalSystem, executorSystem);
  const dispatch = await proposal.createWorkflowDispatchProposal('release-check.yml', 'main', {});
  assert.strictEqual(dispatch.ok, true, 'workflow dispatch creates proposal');
  assert.strictEqual(store.proposals.length, 1, 'proposal saved');

  console.log('test-github-actions-status: ok');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
