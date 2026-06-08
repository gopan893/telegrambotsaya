'use strict';

const decisionEngine = require('../src/governance/governance-decision-engine');

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

console.log('\n=== test-governance-decision-engine.js ===\n');

// Test evaluateGovernanceAction - read
const readDecision = decisionEngine.evaluateGovernanceAction(
  { name: 'status.check', actionType: 'read' },
  { id: 'user123' }
);
assert(readDecision.allowed === true, 'Read action is allowed');
assert(readDecision.blocked === false, 'Read action not blocked');
assert(readDecision.outcome === 'allow_read' || readDecision.outcome === 'allow_dry_run', 'Read outcome is allow');
assert(readDecision.riskLevel === 'read_only' || readDecision.riskLevel === 'low', 'Read risk is read_only or low');

// Test external_write
const extWriteDecision = decisionEngine.evaluateGovernanceAction(
  { name: 'github.push.propose', actionType: 'external_write' },
  { id: 'user123' },
  { payload: 'update README' }
);
assert(extWriteDecision.allowed === false || extWriteDecision.proposalRequired === true, 'External write not directly allowed');
assert(extWriteDecision.evaluationRequired === true, 'External write requires evaluation');
assert(extWriteDecision.executorApprovalRequired === true, 'External write requires executor approval');
assert(extWriteDecision.id.length > 0, 'Decision has ID');

// Test dangerous action
const dangerousDecision = decisionEngine.evaluateGovernanceAction(
  { name: 'rollback.production', actionType: 'dangerous' },
  { id: 'owner123' },
  {},
  { env: { OWNER_CHAT_ID: 'owner123' } }
);
assert(dangerousDecision.riskLevel === 'danger', 'Dangerous risk is danger');

// Test destructive action
const destructiveDecision = decisionEngine.evaluateGovernanceAction(
  { name: 'delete.all.data', actionType: 'destructive' },
  { id: 'user123' }
);
assert(destructiveDecision.blocked === true || destructiveDecision.riskLevel === 'blocked', 'Destructive action is blocked');

// Test with secret payload
const secretDecision = decisionEngine.evaluateGovernanceAction(
  { name: 'memory.write', actionType: 'internal_write' },
  { id: 'user123' },
  { payload: 'Save token=sk-abc123def456ghi to memory', module: 'memory' }
);
assert(secretDecision.blocked === true, 'Secret in memory write is blocked');

// Test buildGovernanceDecision
const built = decisionEngine.buildGovernanceDecision(
  { name: 'test.action' },
  { allowed: true, riskLevel: 'low' }
);
assert(built.actionId === 'test.action', 'Built decision has action ID');

// Test enforceGovernanceDecision
const blockedEnforce = decisionEngine.enforceGovernanceDecision({ blocked: true, reasons: ['blocked'] });
assert(blockedEnforce.action === 'blocked', 'Blocked decision enforced as blocked');

const allowedEnforce = decisionEngine.enforceGovernanceDecision({ allowed: true, outcome: 'allow_read' });
assert(allowedEnforce.action === 'allowed_read', 'Allowed decision enforced as allowed_read');

const proposalEnforce = decisionEngine.enforceGovernanceDecision({ proposalRequired: true, blocked: false, allowed: false });
assert(proposalEnforce.action === 'proposal_required', 'Proposal decision enforced as proposal_required');

const nullEnforce = decisionEngine.enforceGovernanceDecision(null);
assert(nullEnforce.enforced === false, 'Null decision returns not enforced');
assert(nullEnforce.reason === 'No decision provided', 'Null decision reason');

// Test explainGovernanceDecision
const explanation = decisionEngine.explainGovernanceDecision(readDecision);
assert(explanation.includes('Governance Decision'), 'Explanation contains header');
assert(explanation.includes(readDecision.outcome), 'Explanation contains outcome');

const nullExplanation = decisionEngine.explainGovernanceDecision(null);
assert(nullExplanation === 'No decision data.', 'Null decision explanation');

// Test getRecentDecisions
const recent = decisionEngine.getRecentDecisions(5);
assert(Array.isArray(recent), 'Recent decisions is array');
assert(recent.length > 0, 'Has recent decisions');

// Test evaluateGovernanceAction with string action
const stringActionDecision = decisionEngine.evaluateGovernanceAction(
  'read.status',
  { id: 'user123' }
);
assert(stringActionDecision !== null, 'String action evaluated');
assert(stringActionDecision.actionId === 'read.status', 'String action ID correct');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
