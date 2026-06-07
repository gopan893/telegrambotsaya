'use strict';

const assert = require('assert');
const { ImprovementStore } = require('../src/improvement/improvement-store');

async function runTests() {
  console.log('=== test-outcome-collector.js ===');
  const results = [];

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      results.push({ name, passed: true });
    } catch (err) {
      console.log(`  FAIL: ${name} - ${err.message}`);
      results.push({ name, passed: false, error: err.message });
    }
  }

  const collector = require('../src/improvement/outcome-collector');
  const store = new ImprovementStore();
  const services = { store };

  await runTest('collectWorkflowOutcome creates outcome object', async () => {
    const result = await collector.collectWorkflowOutcome({ summary: 'Build passed', source: 'github_action', workspaceId: 'w1' }, services);
    assert.ok(result, 'outcome should be returned');
    assert.ok(result.id, 'should have id');
    assert.strictEqual(result.outcomeType, 'github_action');
    assert.strictEqual(result.source, 'github_action');
  });

  await runTest('collectTestOutcome handles test results', async () => {
    const result = await collector.collectTestOutcome({ testId: 't1', passed: true, summary: 'All tests OK' }, services);
    assert.ok(result);
    assert.strictEqual(result.outcomeType, 'evaluation_suite');
    assert.strictEqual(result.status, 'success');
  });

  await runTest('collectTestOutcome marks failed when not passed', async () => {
    const result = await collector.collectTestOutcome({ testId: 't2', passed: false, summary: 'Test failed' }, services);
    assert.strictEqual(result.status, 'failed');
  });

  await runTest('collectDeployOutcome handles deploy results', async () => {
    const result = await collector.collectDeployOutcome({ deployId: 'd1', success: true, summary: 'Deploy OK' }, services);
    assert.ok(result);
    assert.strictEqual(result.outcomeType, 'render_deploy');
    assert.strictEqual(result.status, 'success');
  });

  await runTest('collectProposalOutcome captures rejection/approval', async () => {
    const rejected = await collector.collectProposalOutcome({ proposalId: 'p1', state: 'rejected', summary: 'Not approved' }, services);
    assert.strictEqual(rejected.status, 'failed');
    const approved = await collector.collectProposalOutcome({ proposalId: 'p2', state: 'approved', summary: 'Approved' }, services);
    assert.strictEqual(approved.status, 'success');
    const executed = await collector.collectProposalOutcome({ proposalId: 'p3', state: 'executed', summary: 'Done' }, services);
    assert.strictEqual(executed.status, 'success');
  });

  await runTest('collectIncidentOutcome captures incident results', async () => {
    const resolved = await collector.collectIncidentOutcome({ incidentId: 'i1', resolved: true, summary: 'Fixed' }, services);
    assert.strictEqual(resolved.status, 'success');
    const unresolved = await collector.collectIncidentOutcome({ incidentId: 'i2', resolved: false, summary: 'Not fixed' }, services);
    assert.strictEqual(unresolved.status, 'failed');
  });

  await runTest('collectOperatingLoopOutcome captures loop results', async () => {
    const ok = await collector.collectOperatingLoopOutcome({ loopId: 'l1', success: true, summary: 'Loop OK' }, services);
    assert.strictEqual(ok.outcomeType, 'operating_loop');
    assert.strictEqual(ok.status, 'success');
    const fail = await collector.collectOperatingLoopOutcome({ loopId: 'l2', success: false, summary: 'Loop fail' }, services);
    assert.strictEqual(fail.status, 'failed');
  });

  await runTest('getOutcomes filters by type/status', async () => {
    // Don't pass services so collect uses default store (same as getOutcomes)
    const defaultStore = require('../src/improvement/improvement-store').getDefaultStore();
    defaultStore._store.outcomes = [];
    await collector.collectWorkflowOutcome({ summary: 'wf1', source: 'github_action' });
    await collector.collectDeployOutcome({ deployId: 'd_f', success: false, summary: 'deploy fail' });
    const workflowResults = collector.getOutcomes({ type: 'github_action' });
    assert.ok(Array.isArray(workflowResults));
    assert.ok(workflowResults.length >= 1);
    const failedResults = collector.getOutcomes({ status: 'failed' });
    assert.ok(Array.isArray(failedResults));
    assert.ok(failedResults.length >= 1);
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
