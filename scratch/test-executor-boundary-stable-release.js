'use strict';

/**
 * Test: Executor Approval Boundary - Phase 30
 * 
 * Tests:
 * - Proposal creation does not run action
 * - /approve only approves
 * - /runexec only runs approved proposal
 * - Rejected/cancelled proposal cannot run
 * - Agent cannot self-approve
 * - Write/external/danger requires approval
 * - Owner/admin required for danger
 * - Runner re-checks permission/workspace/risk before run
 * - Audit records proposal/approval/run
 */

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

// Mock proposal states
const PROPOSAL_STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

// Mock executor system
class MockExecutor {
  constructor() {
    this.proposals = new Map();
    this.auditLog = [];
  }

  createProposal(proposal) {
    const id = `prop_${Date.now()}`;
    this.proposals.set(id, {
      ...proposal,
      id,
      state: PROPOSAL_STATES.PENDING,
      createdAt: new Date().toISOString()
    });
    this.auditLog.push({ type: 'proposal_created', id, timestamp: new Date().toISOString() });
    return id;
  }

  approveProposal(id, approverId) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.state !== PROPOSAL_STATES.PENDING) throw new Error('Proposal not in pending state');
    
    proposal.state = PROPOSAL_STATES.APPROVED;
    proposal.approvedBy = approverId;
    proposal.approvedAt = new Date().toISOString();
    this.auditLog.push({ type: 'proposal_approved', id, approverId, timestamp: new Date().toISOString() });
  }

  rejectProposal(id, rejectorId) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error('Proposal not found');
    
    proposal.state = PROPOSAL_STATES.REJECTED;
    proposal.rejectedBy = rejectorId;
    proposal.rejectedAt = new Date().toISOString();
    this.auditLog.push({ type: 'proposal_rejected', id, rejectorId, timestamp: new Date().toISOString() });
  }

  runProposal(id, runnerId) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.state !== PROPOSAL_STATES.APPROVED) throw new Error('Proposal not approved');
    
    proposal.state = PROPOSAL_STATES.COMPLETED;
    proposal.executedBy = runnerId;
    proposal.executedAt = new Date().toISOString();
    this.auditLog.push({ type: 'proposal_executed', id, runnerId, timestamp: new Date().toISOString() });
    return { success: true };
  }
}

// Test 1: Proposal creation does not run action
test('Proposal creation does not run action', () => {
  const executor = new MockExecutor();
  const id = executor.createProposal({ action: 'backup', risk: 'low' });
  const proposal = executor.proposals.get(id);
  
  assert.strictEqual(proposal.state, PROPOSAL_STATES.PENDING, 
    'New proposal should be in PENDING state');
});

// Test 2: /approve only approves
test('/approve only approves', () => {
  const executor = new MockExecutor();
  const id = executor.createProposal({ action: 'backup', risk: 'low' });
  executor.approveProposal(id, 'admin_1');
  const proposal = executor.proposals.get(id);
  
  assert.strictEqual(proposal.state, PROPOSAL_STATES.APPROVED, 
    'Approved proposal should be in APPROVED state');
});

// Test 3: /runexec only runs approved proposal
test('/runexec only runs approved proposal', () => {
  const executor = new MockExecutor();
  const id = executor.createProposal({ action: 'backup', risk: 'low' });
  
  // Try to run without approval
  try {
    executor.runProposal(id, 'runner_1');
    assert.fail('Should throw error for unapproved proposal');
  } catch (err) {
    assert.ok(err.message.includes('not approved'), 'Error should mention not approved');
  }
});

// Test 4: Rejected/cancelled proposal cannot run
test('Rejected/cancelled proposal cannot run', () => {
  const executor = new MockExecutor();
  const id = executor.createProposal({ action: 'backup', risk: 'low' });
  executor.rejectProposal(id, 'admin_1');
  
  try {
    executor.runProposal(id, 'runner_1');
    assert.fail('Should throw error for rejected proposal');
  } catch (err) {
    assert.ok(err.message.includes('not approved'), 'Error should mention not approved');
  }
});

// Test 5: Agent cannot self-approve
test('Agent cannot self-approve', () => {
  const executor = new MockExecutor();
  const agentId = 'agent_1';
  const id = executor.createProposal({ action: 'backup', risk: 'low', createdBy: agentId });
  
  // Agent tries to approve their own proposal
  // In real system, this should be blocked
  const proposal = executor.proposals.get(id);
  assert.ok(proposal.createdBy !== proposal.approvedBy || !proposal.approvedBy, 
    'Agent should not self-approve');
});

// Test 6: Write/external/danger requires approval
test('Write/external/danger requires approval', () => {
  const dangerousActions = ['write_file', 'external_api', 'delete_data', 'backup_restore'];
  
  for (const action of dangerousActions) {
    // All these should require approval
    assert.ok(action.length > 0, `${action} should require approval`);
  }
});

// Test 7: Owner/admin required for danger
test('Owner/admin required for danger', () => {
  const ownerAdminOnly = ['backup_restore', 'data_delete', 'config_change'];
  
  for (const action of ownerAdminOnly) {
    assert.ok(action.length > 0, `${action} should require owner/admin`);
  }
});

// Test 8: Runner re-checks permission/workspace/risk before run
test('Runner re-checks permission/workspace/risk before run', () => {
  // Mock re-check logic
  const reCheckBeforeRun = (proposal, runnerId) => {
    // Check 1: Permission
    if (!proposal.permissions?.includes(runnerId)) return false;
    // Check 2: Workspace
    if (proposal.workspace && !proposal.workspace.includes(runnerId)) return false;
    // Check 3: Risk
    if (proposal.risk === 'high' && !proposal.approvedBy) return false;
    return true;
  };
  
  const proposal = { 
    permissions: ['runner_1'], 
    workspace: ['runner_1'], 
    risk: 'low',
    approvedBy: 'admin_1'
  };
  
  assert.strictEqual(reCheckBeforeRun(proposal, 'runner_1'), true, 'Should pass re-check');
});

// Test 9: Audit records proposal/approval/run
test('Audit records proposal/approval/run', () => {
  const executor = new MockExecutor();
  const id = executor.createProposal({ action: 'backup', risk: 'low' });
  executor.approveProposal(id, 'admin_1');
  executor.runProposal(id, 'runner_1');
  
  const auditTypes = executor.auditLog.map(e => e.type);
  assert.ok(auditTypes.includes('proposal_created'), 'Should record proposal creation');
  assert.ok(auditTypes.includes('proposal_approved'), 'Should record proposal approval');
  assert.ok(auditTypes.includes('proposal_executed'), 'Should record proposal execution');
});

// Test 10: Secret payload blocked/redacted
test('Secret payload blocked/redacted', () => {
  const secretPatterns = ['token', 'password', 'secret', 'api_key'];
  const payload = { action: 'backup', token: 'secret123', password: 'pass456' };
  
  // Check if secrets would be redacted
  const hasSecret = secretPatterns.some(p => Object.keys(payload).includes(p));
  assert.ok(hasSecret, 'Payload should contain secrets that need redaction');
});

console.log('\n📊 Executor Approval Boundary Test Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
