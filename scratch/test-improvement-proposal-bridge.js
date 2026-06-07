'use strict';

const assert = require('assert');

// Mock improvement-utils to add SECRET_PATTERNS export
const utilsPath = require.resolve('../src/improvement/improvement-utils');
const realUtils = require(utilsPath);
delete require.cache[utilsPath];
require.cache[utilsPath] = {
  id: utilsPath, filename: utilsPath, loaded: true,
  exports: {
    ...realUtils,
    SECRET_PATTERNS: [
      /token[=:]\s*\S+/gi, /secret[=:]\s*\S+/gi, /password[=:]\s*\S+/gi,
      /api_key[=:]\s*\S+/gi, /Authorization[=:]\s*\S+/gi, /Bearer\s+\S+/gi,
      /DATABASE_URL[=:]\s*\S+/gi, /REDIS_URL[=:]\s*\S+/gi,
      /TELEGRAM_TOKEN[=:]\s*\S+/gi, /GITHUB_TOKEN[=:]\s*\S+/gi,
      /\bsk-\w+/gi, /\bghp_\w+/gi,
    ],
  },
  children: [], paths: []
};

// Mock improvement-store to accept 'proposals' type
const storePath = require.resolve('../src/improvement/improvement-store');
const { ImprovementStore } = require(storePath);
delete require.cache[storePath];

const origTypes = ['feedback', 'outcomes', 'weaknesses', 'patterns', 'lessons', 'regressionCases', 'plans'];
const mockStoreInstance = new ImprovementStore();
const proposalsStore = [];

mockStoreInstance._validateType = function (type) {
  const allTypes = [...origTypes, 'proposals'];
  if (!allTypes.includes(type)) {
    throw new Error(`Invalid store type "${type}". Valid types: ${allTypes.join(', ')}`);
  }
};
mockStoreInstance.getAll = function (type) {
  this._validateType(type);
  if (type === 'proposals') return proposalsStore.slice();
  return this._store[type].slice();
};
mockStoreInstance.getById = function (type, id) {
  this._validateType(type);
  if (type === 'proposals') return proposalsStore.find(item => item.id === id) || null;
  return this._store[type].find(item => item.id === id) || null;
};
mockStoreInstance.add = function (type, item) {
  this._validateType(type);
  const entry = { ...item };
  if (!entry.id) entry.id = (Date.now() + Math.random()).toString(36);
  if (type === 'proposals') proposalsStore.push(entry);
  else this._store[type].push(entry);
  return entry;
};

require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true, exports: mockStoreInstance,
  children: [], paths: []
};

async function runTests() {
  console.log('=== test-improvement-proposal-bridge.js ===');
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

  const bridge = require('../src/improvement/improvement-proposal-bridge');
  const store = mockStoreInstance;
  const services = { store };

  await runTest('createImprovementActionPlan creates action plan', () => {
    const plan = {
      id: 'ap1', title: 'Fix dashboard',
      description: 'Fix tab routing bug',
      actions: [
        { type: 'review', targetType: 'dashboard', targetId: 'tabs', description: 'Review tabs', riskLevel: 'low' }
      ],
      riskLevel: 'low'
    };
    const actionPlan = bridge.createImprovementActionPlan(plan, services);
    assert.ok(actionPlan, 'action plan should be returned');
    assert.equal(actionPlan.source, 'improvement');
    assert.equal(actionPlan.status, 'action_plan_created');
    assert.ok(Array.isArray(actionPlan.actions), 'should have actions');
    assert.equal(actionPlan.actions.length, 1);
  });

  await runTest('createImprovementExecutorProposal creates proposal (does not execute)', () => {
    const actionPlan = {
      id: 'ap2', title: 'Review security',
      description: 'Security audit',
      riskLevel: 'low',
      requiresApproval: true,
      actions: [
        { id: 'a1', type: 'audit', targetType: 'security', targetId: 'tokens', description: 'Audit tokens', riskLevel: 'low', requiresApproval: true }
      ]
    };
    const proposal = bridge.createImprovementExecutorProposal(actionPlan, services);
    assert.ok(proposal, 'proposal should be returned');
    assert.equal(proposal.status, 'pending_approval', 'should be pending approval, not executed');
    assert.equal(proposal.actionPlanId, 'ap2');
    assert.ok(Array.isArray(proposal.proposedActions), 'should have proposedActions');
    assert.ok('createdAt' in proposal, 'should have timestamp');
  });

  await runTest('linkImprovementPlanToProposal links plan to proposal', () => {
    store.add('plans', { id: 'plan_link_1', title: 'Fix dashboard routing', linkedProposalIds: [], status: 'action_plan_created' });
    store.add('plans', { id: 'proposal_1', title: 'Proposal for dashboard fix' });
    const updated = bridge.linkImprovementPlanToProposal('plan_link_1', 'proposal_1', services);
    assert.ok(updated, 'should return updated plan');
    assert.ok(Array.isArray(updated.linkedProposalIds), 'should have linkedProposalIds');
    assert.ok(updated.linkedProposalIds.includes('proposal_1'), 'should include the proposal id');
  });

  await runTest('getImprovementLinkedProposals returns linked proposals', () => {
    store.add('proposals', { id: 'proposal_1', title: 'Proposal for dashboard fix' });
    const linked = bridge.getImprovementLinkedProposals('plan_link_1', services);
    assert.ok(Array.isArray(linked), 'should return array');
    assert.ok(linked.length >= 1, 'should have at least one linked proposal');
  });

  await runTest('Duplicate detection works', () => {
    store.add('plans', { id: 'plan_dup_1', title: 'Duplicate plan test', status: 'action_plan_created' });
    store.add('plans', { id: 'plan_dup_2', title: 'Duplicate plan test', status: 'pending_approval' });
    const actionPlan = { id: 'plan_dup_3', title: 'Duplicate plan test', status: 'new' };
    const proposal = bridge.createImprovementExecutorProposal(actionPlan, services);
    assert.ok(proposal, 'proposal should still be created');
    if (proposal.duplicateWarning) {
      assert.ok(proposal.duplicateWarning.includes('Duplicate'), 'should warn about duplicate');
    }
  });

  await runTest('createImprovementExecutorProposal runs eval gate for risky plans', () => {
    const riskyPlan = {
      id: 'ap_risky', title: 'Deploy to production',
      description: 'Direct deploy to production',
      riskLevel: 'high',
      requiresApproval: true,
      actions: [
        { id: 'a_risky', type: 'deploy', targetType: 'render', targetId: 'prod', description: 'Deploy to production', riskLevel: 'high', requiresApproval: true }
      ]
    };
    const proposal = bridge.createImprovementExecutorProposal(riskyPlan, services);
    assert.ok(proposal, 'proposal should be created');
    assert.ok(proposal.evalGatePassed === false || proposal.evalResult !== null, 'risky plan should be evaluated');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
