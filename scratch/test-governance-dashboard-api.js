'use strict';

const governance = require('../src/governance');

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

console.log('\n=== test-governance-dashboard-api.js ===\n');

// Test getGovernanceStatus
const status = governance.getGovernanceStatus();
assert(status !== null, 'Governance status exists');
assert(status.version === '2.0.0', 'Governance status version is 2.0.0');
assert(status.unifiedPolicy === true, 'Unified policy flag is true');
assert(status.capabilities.total > 40, 'Capabilities total > 40');
assert(status.capabilities.modules > 0, 'Multiple modules registered');
assert(status.legacy.policies.length > 0, 'Legacy policies present');

// Test capability registry via governance module
const capabilities = governance.capabilityRegistry.listCapabilities();
assert(capabilities.length > 40, 'Capability list has entries');

// Test capability contracts via governance module
const contracts = governance.capabilityContracts.getAllContracts();
assert(contracts.length > 40, 'Contracts list has entries');

// Test action policy simulator via governance module
const simulation = governance.actionPolicySimulator.simulateActionPolicy(
  { name: 'github.push.propose', actionType: 'external_write' },
  { id: 'user123' }
);
assert(simulation !== null, 'Simulation via governance module works');
assert(simulation.note.includes('SIMULATION ONLY'), 'Simulation note present');

// Test governance decision engine via governance module
const decision = governance.governanceDecisionEngine.evaluateGovernanceAction(
  { name: 'deploy.production', actionType: 'external_write' },
  { id: 'user123' }
);
assert(decision !== null, 'Decision via governance module works');

// Test secret guard via governance module
const scan = governance.unifiedSecretGuard.scanGovernancePayloadForSecrets('token=sk-abc123def456ghi');
assert(scan.hasSecret === true, 'Secret scan via governance module works');

// Test permission engine via governance module
const permission = governance.unifiedPermissionEngine.resolveActorRole(
  { id: 'owner123' },
  { env: { OWNER_CHAT_ID: 'owner123' } }
);
assert(permission === 'owner', 'Permission engine via governance module works');

// Test risk engine via governance module
const risk = governance.unifiedRiskEngine.classifyGovernanceRisk(
  { actionType: 'external_write', name: 'data.export' }
);
assert(risk.riskLevel === 'high', 'Risk engine via governance module works');

// Test approval policy via governance module
const approval = governance.unifiedApprovalPolicy.determineApprovalRequirement(
  { actionType: 'external_write' },
  { riskLevel: 'high' }
);
assert(approval.requiresApproval === true, 'Approval policy via governance module works');

// Test evaluation policy via governance module
const evalReq = governance.unifiedEvaluationPolicy.determineEvaluationRequirement(
  { name: 'deploy.production' },
  { riskLevel: 'high' }
);
assert(evalReq.evaluationRequired === true, 'Evaluation policy via governance module works');

// Test cost policy via governance module
const costGuard = governance.unifiedCostPolicy.determineCostGuardRequirement(
  { actionType: 'external_write' }
);
assert(costGuard !== null, 'Cost policy via governance module works');

// Test governance audit via governance module
governance.governanceAudit.recordGovernanceDecision(decision);
const auditEvents = governance.governanceAudit.listGovernanceAudit();
assert(auditEvents.length > 0, 'Audit events recorded via governance module');

// Test governance utils via governance module
const sanitized = governance.governanceUtils.sanitizeForReport('My token is sk-abc123def456ghi');
assert(sanitized.includes('[REDACTED_API_KEY]'), 'Sanitize via governance utils works');

// Test governance policy store via governance module
const policy = governance.governancePolicyStore.getGovernancePolicy();
assert(policy.rules.noDirectExternalWrite === true, 'Governance policy store via governance module works');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
