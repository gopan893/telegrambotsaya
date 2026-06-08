'use strict';

const simulator = require('../src/governance/action-policy-simulator');

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

console.log('\n=== test-action-policy-simulator.js ===\n');

// Test simulateActionPolicy - safe read
const readSim = simulator.simulateActionPolicy(
  { name: 'status.check', actionType: 'read' },
  { id: 'user123' },
  {}
);
assert(readSim.allowed === true, 'Read action simulation is allowed');
assert(readSim.simulatedOutcome === 'allow_read' || readSim.simulatedOutcome === 'allow_dry_run', 'Read outcome is allow_read or allow_dry_run');
assert(readSim.note.includes('SIMULATION ONLY'), 'Simulation note present');

// Test external_write simulation
const extWriteSim = simulator.simulateActionPolicy(
  { name: 'github.push.propose', actionType: 'external_write' },
  { id: 'user123' },
  {}
);
assert(extWriteSim.simulatedOutcome !== 'allow_read', 'External write is not allow_read');
assert(extWriteSim.risk.riskLevel === 'high' || extWriteSim.risk.riskLevel === 'danger', 'External write risk is high/danger');
assert(extWriteSim.permission.allowed !== undefined, 'Permission check present');

// Test risky action
const deploySim = simulator.simulateActionPolicy(
  { name: 'deploy.production', actionType: 'dangerous' },
  { id: 'user123' },
  {}
);
assert(deploySim.risk.riskLevel === 'danger' || deploySim.risk.riskLevel === 'high', 'Deploy simulation risk is high/danger');

// Test simulateTelegramCommand
const capsSim = simulator.simulateTelegramCommand('/capabilities', [], { id: 'user123' });
assert(capsSim.command === '/capabilities', 'Telegram command simulation correct');
assert(capsSim.allowed === true, 'Capabilities command is allowed');

const govSim = simulator.simulateTelegramCommand('/governance', [], { id: 'owner123' });
assert(govSim.command === '/governance', 'Governance command simulation correct');

// Test simulateNaturalIntent - GitHub push
const githubIntent = simulator.simulateNaturalIntent('bolehkah bot push ke GitHub langsung?', { id: 'user123' });
assert(githubIntent.detectedIntent.actionType === 'external_write', 'GitHub push intent detected as external_write');
assert(githubIntent.simulatedOutcome !== 'allow_read', 'GitHub push simulation not allow_read');

// Test simulateNaturalIntent - deploy
const deployIntent = simulator.simulateNaturalIntent('simulasikan deploy ke Render', { id: 'user123' });
assert(deployIntent.detectedIntent.actionType === 'dry_run' || deployIntent.detectedIntent.actionType === 'external_write', 'Deploy simulation intent detected');
assert(deployIntent.allowed !== undefined, 'Deploy simulation has allowed status');

// Test simulateNaturalIntent - Gmail
const gmailIntent = simulator.simulateNaturalIntent('kirim Gmail sekarang tanpa approval', { id: 'user123' });
const isGmailOrWrite = gmailIntent.detectedIntent.module === 'gmail' || gmailIntent.detectedIntent.actionType === 'external_write';
assert(isGmailOrWrite, 'Gmail intent detected as external_write');

// Test simulateNaturalIntent - restore
const restoreIntent = simulator.simulateNaturalIntent('restore backup langsung', { id: 'user123' });
assert(restoreIntent.detectedIntent.actionType === 'dangerous', 'Restore intent is dangerous');
assert(restoreIntent.detectedIntent.riskLevel === 'danger', 'Restore risk is danger');

// Test simulateNaturalIntent - policy check
const policyIntent = simulator.simulateNaturalIntent('cek policy GitHub push', { id: 'user123' });
const isPolicyOrRead = policyIntent.detectedIntent.module === 'governance' || policyIntent.detectedIntent.actionType === 'read';
assert(isPolicyOrRead, 'Policy check intent detected');

// Test simulateModuleCapability
const capSim = simulator.simulateModuleCapability('githubops.push.propose', { id: 'user123' });
assert(capSim.capability.id === 'githubops.push.propose', 'Module capability simulation correct');

const missingSim = simulator.simulateModuleCapability('nonexistent.capability', { id: 'user123' });
assert(missingSim.error !== undefined, 'Non-existent capability returns error');

// Test buildPolicySimulationReport
const report = simulator.buildPolicySimulationReport(readSim);
assert(report.includes('Policy Simulation Report'), 'Report header present');
assert(report.includes('SIMULATION ONLY'), 'Report includes simulation note');

const errorReport = simulator.buildPolicySimulationReport({ error: 'test error' });
assert(errorReport.error === 'test error', 'Error report passed through');

// Test TELEGRAM_COMMAND_POLICY
const commandPolicy = simulator.TELEGRAM_COMMAND_POLICY;
assert(commandPolicy['/governance'] !== undefined, 'Governance command in policy');
assert(commandPolicy['/capabilities'] !== undefined, 'Capabilities command in policy');
assert(commandPolicy['/simulate_action'] !== undefined, 'Simulate action command in policy');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
