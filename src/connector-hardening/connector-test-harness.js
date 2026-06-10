'use strict';

function createTestHarness(connectorId, config) {
  return {
    connectorId,
    config: config || {},
    results: [],
    status: 'idle',
    createdAt: new Date().toISOString()
  };
}

function runReadOnlyTests(harness, testSuite) {
  if (!harness) return { ok: false, error: 'No harness' };
  harness.status = 'running';
  const tests = Array.isArray(testSuite) ? testSuite : [];
  const results = [];

  for (const test of tests) {
    const result = { name: test.name || 'unnamed', status: 'pending', duration: 0 };
    const start = Date.now();
    try {
      if (typeof test.fn === 'function') {
        const output = test.fn(harness.config);
        result.status = output && output.ok === false ? 'fail' : 'pass';
        result.output = output;
      } else {
        result.status = 'skip';
        result.output = 'No test function';
      }
    } catch (err) {
      result.status = 'fail';
      result.error = err.message;
    }
    result.duration = Date.now() - start;
    results.push(result);
  }

  harness.results = results;
  harness.status = 'completed';
  harness.completedAt = new Date().toISOString();

  return {
    ok: true,
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    skipped: results.filter(r => r.status === 'skip').length,
    results
  };
}

function simulateWriteProposal(harness, action) {
  if (!harness) return { ok: false, error: 'No harness' };
  if (!action || !action.type) return { ok: false, error: 'Action type required' };

  const proposal = {
    connectorId: harness.connectorId,
    action: action.type,
    target: action.target || null,
    params: action.params || {},
    proposalOnly: true,
    wouldExecute: false,
    simulatedAt: new Date().toISOString(),
    risk: classifyConnectorAction(action.type),
    status: 'proposal_only'
  };

  harness.results.push({ name: 'write_proposal_' + action.type, status: 'proposal', output: proposal });
  return { ok: true, proposal };
}

function classifyConnectorAction(actionType) {
  if (!actionType) return { level: 'unknown', proposalRequired: true };
  const lower = String(actionType).toLowerCase();
  if (['read', 'get', 'list', 'fetch', 'search'].some(k => lower.includes(k))) {
    return { level: 'low', proposalRequired: false };
  }
  if (['write', 'create', 'update', 'delete', 'send', 'post', 'push'].some(k => lower.includes(k))) {
    return { level: 'high', proposalRequired: true };
  }
  if (['deploy', 'release', 'rollback', 'restore', 'shell', 'exec'].some(k => lower.includes(k))) {
    return { level: 'critical', proposalRequired: true };
  }
  return { level: 'medium', proposalRequired: true };
}

function getTestSummary(harness) {
  if (!harness) return {};
  const results = harness.results || [];
  return {
    connectorId: harness.connectorId,
    status: harness.status,
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    skipped: results.filter(r => r.status === 'skip').length,
    proposals: results.filter(r => r.status === 'proposal').length
  };
}

module.exports = {
  createTestHarness, runReadOnlyTests, simulateWriteProposal,
  classifyConnectorAction, getTestSummary
};
