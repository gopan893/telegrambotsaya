'use strict';

const promptGen = require('../src/devgovernance/next-agent-prompt-generator');

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

  console.log('\n📝 test-next-agent-prompt-generator.js\n');

  // 1. Generate Codex prompt
  const codexPrompt = promptGen.generateNextCodexPrompt();
  assert(codexPrompt.includes('# Codex Next Task Prompt'), 'Codex prompt has correct header');
  assert(codexPrompt.includes('## Constraints'), 'Codex prompt has constraints section');
  assert(codexPrompt.includes('Node.js 20'), 'Codex prompt has runtime constraint');

  // 2. Generate OpenCode prompt
  const openCodePrompt = promptGen.generateNextOpenCodePrompt();
  assert(openCodePrompt.includes('# OpenCode Next Task Prompt'), 'OpenCode prompt has correct header');

  // 3. Generate recovery prompt
  const recoveryPrompt = promptGen.generateRecoveryPrompt();
  assert(recoveryPrompt.includes('# Recovery Agent Prompt'), 'Recovery prompt has correct header');
  assert(recoveryPrompt.includes('## Recovery Steps'), 'Recovery prompt has steps');

  // 4. Generate P0 prompt
  const p0Prompt = promptGen.generateP0PatchPrompt({ issue: 'Test critical bug' });
  assert(p0Prompt.includes('# P0 Patch Prompt'), 'P0 prompt has correct header');
  assert(p0Prompt.includes('Test critical bug'), 'P0 prompt includes issue');

  // 5. Generate review prompt
  const reviewPrompt = promptGen.generatePostCodexReviewPrompt();
  assert(reviewPrompt.includes('# Post-Codex Review Prompt'), 'Review prompt has correct header');

  // 6. Generate by type
  const typed = promptGen.generateNextAgentPrompt('codex', { services: {} });
  assert(typed.ok, 'generateNextAgentPrompt returns ok');
  assert(typed.type === 'codex', 'type is preserved');
  assert(typed.prompt.length > 100, 'prompt is non-empty');

  const recoveryTyped = promptGen.generateNextAgentPrompt('recovery', { services: {} });
  assert(recoveryTyped.ok, 'recovery prompt via type returns ok');
  assert(recoveryTyped.type === 'recovery', 'recovery type preserved');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
