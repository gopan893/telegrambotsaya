'use strict';

const assert = require('assert');
const actionPlan = require('../src/agents/agent-action-plan');
const preflight = require('../src/agents/executor-preflight-review');

(async () => {
  const safe = actionPlan.buildActionPlan({
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Backup',
    actions: [{ type: 'backup.create', description: 'Create backup', payload: {}, riskLevel: 'medium' }]
  });
  const safeReview = await preflight.runExecutorPreflight(safe, {});
  assert.equal(safeReview.allowedToPropose, true);
  assert.equal(safeReview.allowedToRunDirectly, false);
  assert.equal(safeReview.approvalRequired, true);

  const shell = actionPlan.buildActionPlan({
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Shell blocked',
    actions: [{ type: 'shell.exec', description: 'run shell', payload: {}, riskLevel: 'danger' }]
  });
  const shellReview = await preflight.runExecutorPreflight(shell, {});
  assert.equal(shellReview.allowedToPropose, false);
  assert.ok(shellReview.blockers.some(item => item.includes('UNSUPPORTED_ACTION')));

  const restore = actionPlan.buildActionPlan({
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Restore',
    actions: [{ type: 'restore.run', description: 'restore backup', payload: {}, riskLevel: 'danger' }]
  });
  const restoreReview = await preflight.runExecutorPreflight(restore, {});
  assert.equal(restoreReview.allowedToPropose, true);
  assert.equal(restoreReview.ownerAdminRequired, true);
  assert.equal(restoreReview.securityReviewRequired, true);

  console.log('test-executor-preflight-review: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
