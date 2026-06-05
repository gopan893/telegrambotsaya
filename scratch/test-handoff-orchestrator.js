'use strict';

const path = require('path');
const fs = require('fs');
const handoff = require('../src/devgovernance/handoff-orchestrator');

const repoRoot = process.cwd();
const services = { repoRoot };

async function run() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log('\n📋 test-handoff-orchestrator.js\n');

  // 1. Read handoff
  const readResult = handoff.readHandoff(services);
  assert(readResult.ok, 'readHandoff returns ok');
  assert(readResult.handoff !== null, 'readHandoff returns handoff object');

  // 2. Write handoff
  const testHandoff = {
    id: 'test-1',
    lastAgent: 'test',
    currentTask: 'Test task',
    goal: 'Test goal',
    filesChanged: ['test.js'],
    completed: ['done'],
    unfinished: [],
    testsRun: ['node --check telebot.js'],
    testsFailed: [],
    testsSkipped: [],
    remainingRisks: [],
    nextAgentTask: 'Continue'
  };
  const writeResult = handoff.writeHandoff(testHandoff, services);
  assert(writeResult.ok, 'writeHandoff returns ok');
  assert(writeResult.handoff !== null, 'writeHandoff returns handoff');

  // 3. Generate handoff summary
  const summary = handoff.generateHandoffSummary(services);
  assert(summary.ok, 'generateHandoffSummary returns ok');
  assert(summary.summary !== undefined, 'generateHandoffSummary has summary');
  assert(summary.summary.lastAgent === 'test', 'generateHandoffSummary contains correct agent');

  // 4. Update handoff after task
  const updateResult = handoff.updateHandoffAfterTask({
    completed: ['New completion'],
    testsRun: ['node scratch/test-handoff-orchestrator.js'],
    currentTask: 'Updated task'
  }, services);
  assert(updateResult.ok, 'updateHandoffAfterTask returns ok');

  // 5. Recovery handoff
  const recoveryResult = handoff.createRecoveryHandoffFromGitDiff({ lastAgent: 'codex', currentTask: 'Interrupted task' }, services);
  assert(recoveryResult.ok, 'createRecoveryHandoffFromGitDiff returns ok');
  assert(recoveryResult.handoff.lastAgent === 'codex', 'recovery handoff preserves lastAgent');

  // 6. Handoff model structure
  const modelKeys = ['id', 'lastAgent', 'currentTask', 'goal', 'filesChanged', 'completed', 'unfinished', 'testsRun', 'testsFailed', 'testsSkipped', 'remainingRisks', 'nextAgentTask', 'createdAt', 'updatedAt'];
  for (const key of modelKeys) {
    assert(recoveryResult.handoff[key] !== undefined, `handoff has field: ${key}`);
  }

  // Restore original test handoff
  handoff.writeHandoff(testHandoff, services);

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
