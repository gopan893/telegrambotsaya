'use strict';

const governance = require('../src/governance');

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

function skip(label) {
  console.log(`  SKIPPED: ${label}`);
  skipped++;
}

console.log('\n=== test-phase47-governance-regression.js ===\n');

console.log('--- Quality Gate 1: governancePolicyScore >= 95 ---');
try {
  const policy = governance.governancePolicyStore.getGovernancePolicy();
  const rules = Object.keys(policy.rules);
  const allPresent = [
    'noDirectExternalWrite', 'noDirectGitHubPush', 'noDirectWorkflowDispatch',
    'noDirectDeployRollback', 'noDirectGmailSend', 'noDirectCalendarWrite',
    'noDirectWebhookPost', 'noShellExecutor', 'noAutoApprove',
    'noAutoRunWriteExternalDanger', 'noSelfModifyingPolicy', 'noHiddenPolicyBypass',
    'noUnsafeAdminBackdoor', 'noHardDeletePolicyLogs', 'noSecretExposure'
  ];
  const score = allPresent.filter(r => rules.includes(r)).length / allPresent.length;
  assert(score >= 0.95, `Governance policy score: ${Math.round(score * 100)}%`);
} catch (e) {
  assert(false, 'Governance policy score check failed: ' + e.message);
}

console.log('--- Quality Gate 2: permissionDecisionScore = 100 ---');
try {
  const permission = governance.unifiedPermissionEngine.resolveActorRole(
    { id: 'owner123' },
    { env: { OWNER_CHAT_ID: 'owner123', ADMIN_IDS: 'admin1' } }
  );
  assert(permission === 'owner', 'Owner role resolved correctly');

  const adminRole = governance.unifiedPermissionEngine.resolveActorRole(
    { id: 'admin1' },
    { env: { OWNER_CHAT_ID: 'owner123', ADMIN_IDS: 'admin1' } }
  );
  assert(adminRole === 'admin', 'Admin role resolved correctly');

  const userRole = governance.unifiedPermissionEngine.resolveActorRole(
    { id: 'user123' },
    { env: { OWNER_CHAT_ID: 'owner123', ADMIN_IDS: 'admin1' } }
  );
  assert(userRole === 'user', 'User role resolved correctly');
} catch (e) {
  assert(false, 'Permission decision check failed: ' + e.message);
}

console.log('--- Quality Gate 3: secretGuardScore = 100 ---');
try {
  const secretScan = governance.unifiedSecretGuard.scanGovernancePayloadForSecrets('password=secret123');
  assert(secretScan.hasSecret === true, 'Secret guard detects passwords');

  const noSecret = governance.unifiedSecretGuard.scanGovernancePayloadForSecrets('Hello world');
  assert(noSecret.hasSecret === false, 'Secret guard passes clean text');

  const redacted = governance.unifiedSecretGuard.redactGovernancePayload('token=sk-abc123');
  assert(redacted.includes('[REDACTED_SECRET]'), 'Secret redaction works');
} catch (e) {
  assert(false, 'Secret guard check failed: ' + e.message);
}

console.log('--- Quality Gate 4: approvalBoundaryScore = 100 ---');
try {
  const readApproval = governance.unifiedApprovalPolicy.determineApprovalRequirement(
    { actionType: 'read' }, { riskLevel: 'read_only' }
  );
  assert(readApproval.canRunDirectly === true, 'Read actions can run directly');
  assert(readApproval.requiresApproval === false, 'Read actions do not require approval');

  const writeApproval = governance.unifiedApprovalPolicy.determineApprovalRequirement(
    { actionType: 'external_write' }, { riskLevel: 'high' }
  );
  assert(writeApproval.canRunDirectly === false, 'External writes cannot run directly');
  assert(writeApproval.requiresApproval === true, 'External writes require approval');
  assert(writeApproval.requiresExecutor === true, 'External writes require executor');
} catch (e) {
  assert(false, 'Approval boundary check failed: ' + e.message);
}

console.log('--- Quality Gate 5: evaluationRequirementScore >= 95 ---');
try {
  const githubEval = governance.unifiedEvaluationPolicy.determineEvaluationRequirement(
    { name: 'github.push.propose' }, { riskLevel: 'high' }
  );
  assert(githubEval.evaluationRequired === true, 'GitHub push requires evaluation');

  const deployEval = governance.unifiedEvaluationPolicy.determineEvaluationRequirement(
    { name: 'deploy.production' }, { riskLevel: 'high' }
  );
  assert(deployEval.evaluationRequired === true, 'Deploy requires evaluation');

  const readEval = governance.unifiedEvaluationPolicy.determineEvaluationRequirement(
    { name: 'read.status' }, { riskLevel: 'read_only' }
  );
  assert(readEval.evaluationRequired === false, 'Read does not require evaluation');
} catch (e) {
  assert(false, 'Evaluation requirement check failed: ' + e.message);
}

console.log('--- Quality Gate 6: no direct external write ---');
try {
  const decision = governance.governanceDecisionEngine.evaluateGovernanceAction(
    { name: 'github.push.propose', actionType: 'external_write' },
    { id: 'user123' }
  );
  assert(decision.proposalRequired === true || decision.blocked === true, 'External write requires proposal or is blocked');
  assert(decision.allowed === false, 'External write not directly allowed');
} catch (e) {
  assert(false, 'No direct external write check failed: ' + e.message);
}

console.log('--- Quality Gate 7: no secret leakage ---');
try {
  const scan = governance.unifiedSecretGuard.scanGovernancePayloadForSecrets('token=sk-abc123');
  assert(scan.hasSecret === true, 'Secrets are detected');

  const redacted = governance.unifiedSecretGuard.redactGovernancePayload('token=sk-abc123');
  assert(!redacted.includes('sk-abc123'), 'Secrets are redacted from output');
} catch (e) {
  assert(false, 'No secret leakage check failed: ' + e.message);
}

console.log('--- Quality Gate 8: no auto-approve ---');
try {
  const approval = governance.unifiedApprovalPolicy.determineApprovalRequirement(
    { actionType: 'external_write' }, { riskLevel: 'high' }
  );
  assert(approval.requiresApproval === true, 'External write requires approval');
  assert(approval.canRunDirectly === false, 'External write cannot auto-run');
} catch (e) {
  assert(false, 'No auto-approve check failed: ' + e.message);
}

console.log('--- Quality Gate 9: no bypass by module ---');
try {
  const allCaps = governance.capabilityRegistry.listCapabilities();
  const blockedCaps = ['operating_loop.external.run', 'improvement.code.patch', 'gmail.send', 'memory.delete'];
  for (const capId of blockedCaps) {
    const cap = governance.capabilityRegistry.getCapability(capId);
    if (cap) {
      assert(cap.enabled === false, `${capId} is disabled`);
    } else {
      skip(`Capability ${capId} not found (module may not exist)`);
    }
  }
} catch (e) {
  assert(false, 'No bypass check failed: ' + e.message);
}

console.log('\n--- Simulated Telegram Commands ---');
try {
  let sim;
  sim = governance.actionPolicySimulator.simulateNaturalIntent('bolehkah bot push ke GitHub langsung?', { id: 'user123' });
  assert(sim.detectedIntent.module === 'githubops' || sim.detectedIntent.module === 'github', 'GitHub push intent detected');
  assert(sim.detectedIntent.actionType === 'external_write', 'GitHub push is external_write');

  sim = governance.actionPolicySimulator.simulateNaturalIntent('simulasikan deploy ke Render', { id: 'user123' });
  assert(sim.detectedIntent.actionType === 'dry_run' || sim.detectedIntent.actionType === 'external_write', 'Deploy simulation intent detected');

  sim = governance.actionPolicySimulator.simulateNaturalIntent('cek policy GitHub push', { id: 'user123' });
  assert(sim.detectedIntent.module === 'governance' || sim.detectedIntent.actionType === 'read', 'Policy check intent detected');

  sim = governance.actionPolicySimulator.simulateNaturalIntent('kirim Gmail sekarang tanpa approval', { id: 'user123' });
  assert(sim.detectedIntent.module === 'gmail' || sim.detectedIntent.actionType === 'external_write', 'Gmail send intent detected');

  sim = governance.actionPolicySimulator.simulateNaturalIntent('restore backup langsung', { id: 'user123' });
  assert(sim.detectedIntent.actionType === 'dangerous', 'Restore intent is dangerous');

  sim = governance.actionPolicySimulator.simulateNaturalIntent('simpan DATABASE_URL ke memory', { id: 'user123' });
  assert(sim.detectedIntent.module === 'memory', 'DATABASE_URL to memory intent detected');

  sim = governance.actionPolicySimulator.simulateNaturalIntent('operating loop jalankan deploy otomatis', { id: 'user123' });
  assert(sim.detectedIntent.module === 'operating_loop' || sim.detectedIntent.module === 'githubops', 'Operating loop intent detected');
} catch (e) {
  assert(false, 'Telegram command simulation failed: ' + e.message);
}

console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
process.exit(failed > 0 ? 1 : 0);
