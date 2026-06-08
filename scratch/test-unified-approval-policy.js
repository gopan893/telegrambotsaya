'use strict';

const approvalPolicy = require('../src/governance/unified-approval-policy');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== test-unified-approval-policy.js ===\n');

// Test read action - direct
const readDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'read' }, { riskLevel: 'read_only' }
);
assert(readDecision.canRunDirectly === true, 'Read action can run directly');
assert(readDecision.requiresApproval === false, 'Read does not require approval');

// Test report action
const reportDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'report' }, { riskLevel: 'read_only' }
);
assert(reportDecision.canRunDirectly === true, 'Report can run directly');

// Test dry_run action
const dryRunDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'dry_run' }, { riskLevel: 'low' }
);
assert(dryRunDecision.canRunDirectly === true, 'Dry run can run directly');

// Test plan action
const planDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'plan' }, { riskLevel: 'low' }
);
assert(planDecision.canRunDirectly === true, 'Plan can run directly');

// Test proposal action
const proposalDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'proposal' }, { riskLevel: 'low' }
);
assert(proposalDecision.canRunDirectly === true, 'Proposal can run directly');

// Test external_write action
const extWriteDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'external_write' }, { riskLevel: 'high' }
);
assert(extWriteDecision.canRunDirectly === false, 'External write cannot run directly');
assert(extWriteDecision.requiresApproval === true, 'External write requires approval');
assert(extWriteDecision.requiresExecutor === true, 'External write requires executor');

// Test dangerous action
const dangerousDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'dangerous' }, { riskLevel: 'danger' }
);
assert(dangerousDecision.canRunDirectly === false, 'Dangerous cannot run directly');
assert(dangerousDecision.requiresApproval === true, 'Dangerous requires approval');
assert(dangerousDecision.requiresExecutor === true, 'Dangerous requires executor');

// Test destructive action
const destructiveDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'destructive' }, { riskLevel: 'blocked' }
);
assert(destructiveDecision.canRunDirectly === false, 'Destructive cannot run directly');

// Test blocked risk
const blockedDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'external_write' }, { riskLevel: 'blocked' }
);
assert(blockedDecision.blocked === true, 'Blocked risk returns blocked');

// Test danger risk with owner
const dangerDecision = approvalPolicy.determineApprovalRequirement(
  { actionType: 'external_write' }, { riskLevel: 'danger' }
);
assert(dangerDecision.requiresOwner === true, 'Danger risk requires owner');

// Test requiresExecutorApproval helper
assert(approvalPolicy.requiresExecutorApproval(
  { actionType: 'external_write' }, { riskLevel: 'high' }
) === true, 'requiresExecutorApproval true for external_write');

assert(approvalPolicy.requiresExecutorApproval(
  { actionType: 'read' }, { riskLevel: 'read_only' }
) === false, 'requiresExecutorApproval false for read');

// Test requiresOwnerApproval helper
assert(approvalPolicy.requiresOwnerApproval(
  { actionType: 'dangerous' }, { riskLevel: 'danger' }
) === true, 'requiresOwnerApproval true for dangerous');

// Test canRunDirectly helper
assert(approvalPolicy.canRunDirectly(
  { actionType: 'read' }, { riskLevel: 'read_only' }
) === true, 'canRunDirectly true for read');

assert(approvalPolicy.canRunDirectly(
  { actionType: 'external_write' }, { riskLevel: 'high' }
) === false, 'canRunDirectly false for external_write');

// Test buildApprovalDecision
const decision = approvalPolicy.buildApprovalDecision(
  { name: 'github.push.propose', actionType: 'external_write' },
  { riskLevel: 'high' }
);
assert(decision.actionName === 'github.push.propose', 'Decision action name correct');
assert(decision.summary.includes('requires'), 'Decision summary mentions requires');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
