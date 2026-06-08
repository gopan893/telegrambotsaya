'use strict';

const riskEngine = require('../src/governance/unified-risk-engine');

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

console.log('\n=== test-unified-risk-engine.js ===\n');

// Test classifyGovernanceRisk for read action
const readRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'read', name: 'status.check' }
);
assert(readRisk.riskLevel === 'read_only', 'Read action is read_only');
assert(readRisk.riskScore === 0, 'Read action score is 0');

// Test report action
const reportRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'report', name: 'generate.report' }
);
assert(reportRisk.riskLevel === 'read_only', 'Report action is read_only');

// Test plan action
const planRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'plan', name: 'create.plan' }
);
assert(planRisk.riskLevel === 'low', 'Plan action is low risk');

// Test dry_run action
const dryRunRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'dry_run', name: 'simulate.deploy' }
);
assert(dryRunRisk.riskLevel === 'low', 'Dry run is low risk');

// Test destructive action
const destructiveRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'destructive', name: 'delete.all' }
);
assert(destructiveRisk.riskLevel === 'blocked', 'Destructive is blocked');
assert(destructiveRisk.blocked === true, 'Destructive is marked blocked');

// Test dangerous action
const dangerousRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'dangerous', name: 'rollback.production' }
);
assert(dangerousRisk.riskLevel === 'danger', 'Dangerous action is danger');

// Test external_write (non-danger pattern)
const extWriteRisk = riskEngine.classifyGovernanceRisk(
  { actionType: 'external_write', name: 'data.export' }
);
assert(extWriteRisk.riskLevel === 'high', 'External write is high risk');

// Test danger pattern matching
const deployRisk = riskEngine.classifyGovernanceRisk(
  { name: 'deploy.production', actionType: 'unknown' }
);
assert(deployRisk.riskLevel === 'danger', 'Deploy production pattern detected as danger');

const pushRisk = riskEngine.classifyGovernanceRisk(
  { name: 'github.push.master', actionType: 'unknown' }
);
assert(pushRisk.riskLevel === 'danger', 'GitHub push pattern detected as danger');

// Test classifyPayloadRisk
const cleanPayload = riskEngine.classifyPayloadRisk('Hello, how are you?');
assert(cleanPayload.hasSecret === false, 'Clean payload has no secrets');
assert(cleanPayload.riskLevel === 'low', 'Clean payload is low risk');

const secretPayload = riskEngine.classifyPayloadRisk('My token is sk-abc123def456');
assert(secretPayload.hasSecret === true, 'Secret payload detected');
assert(secretPayload.riskLevel === 'high', 'Secret payload is high risk');

// Test classifyExternalSystemRisk
const githubSystem = riskEngine.classifyExternalSystemRisk({ externalSystem: 'github' });
assert(githubSystem.riskLevel === 'high', 'GitHub system is high risk');

const renderSystem = riskEngine.classifyExternalSystemRisk({ externalSystem: 'render' });
assert(renderSystem.riskLevel === 'danger', 'Render system is danger risk');

// Test buildRiskDecision
const decision = riskEngine.buildRiskDecision(
  { name: 'github.push', actionType: 'external_write' },
  { payload: 'update readme' }
);
assert(decision.riskLevel === 'high' || decision.riskLevel === 'danger', 'Combined risk decision correct');
assert(typeof decision.riskScore === 'number', 'Risk score is number');

// Test data sensitivity
const sensitive = riskEngine.classifyDataSensitivity({ module: 'lifeos' });
assert(sensitive.sensitive === true, 'LifeOS module is sensitive');

const nonSensitive = riskEngine.classifyDataSensitivity({ module: 'telegram_control' });
assert(nonSensitive.sensitive === false, 'Telegram control is not sensitive');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
