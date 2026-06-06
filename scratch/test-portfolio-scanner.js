'use strict';

const assert = require('assert');
const scanner = require('../src/portfolio/portfolio-scanner');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  assert.strictEqual(snapshot.ok, true);
  assert.strictEqual(snapshot.totals.activeGoals, 2);
  assert.strictEqual(snapshot.totals.activeTasks, 2);
  assert.strictEqual(snapshot.totals.blockedTasks, 1);
  assert.strictEqual(snapshot.totals.pendingApprovals, 1);
  assert.strictEqual(snapshot.totals.openIncidents, 1);
  assert(!JSON.stringify(snapshot).includes('DATABASE_URL'));
  console.log('test-portfolio-scanner: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
