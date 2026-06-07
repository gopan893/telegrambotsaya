'use strict';

const assert = require('assert');
const { ImprovementStore } = require('../src/improvement/improvement-store');

async function runTests() {
  console.log('=== test-next-agent-improvement-prompt.js ===');
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

  const promptGen = require('../src/improvement/next-agent-improvement-prompt');
  const store = new ImprovementStore();
  store.add('plans', {
    id: 'plan_prompt_1', title: 'Fix dashboard tab routing',
    summary: 'Dashboard tabs falling back to overview',
    targetModules: ['dashboard', 'src/routes/dashboard.js'],
    proposedSteps: ['Fix tab registry', 'Add tests'],
    riskLevel: 'medium', sourceWeaknessIds: [], sourceLessonIds: []
  });
  store.add('weaknesses', { id: 'w_prompt_1', title: 'Dashboard route fallback', description: 'Tabs fall back to overview' });
  store.add('lessons', { id: 'l_prompt_1', title: 'Always register tabs in sidebar', summary: 'Known tabs must appear' });
  const services = { store };

  await runTest('generateCodexImprovementPrompt returns structured prompt', () => {
    const prompt = promptGen.generateCodexImprovementPrompt('plan_prompt_1', services);
    assert.ok(prompt, 'prompt should be returned');
    assert.equal(prompt.agent, 'codex');
    assert.ok(prompt.goal, 'should have goal');
    assert.ok(prompt.rootCauseSummary, 'should have root cause');
    assert.ok(Array.isArray(prompt.affectedFiles), 'should have affected files');
    assert.ok(Array.isArray(prompt.proposedSteps), 'should have steps');
    assert.ok(Array.isArray(prompt.constraints), 'should have constraints');
    assert.ok(Array.isArray(prompt.safetyRules), 'should have safety rules');
    assert.ok(Array.isArray(prompt.testsToRun), 'should have tests to run');
  });

  await runTest('generateOpenCodeImprovementPrompt returns structured prompt', () => {
    const prompt = promptGen.generateOpenCodeImprovementPrompt('plan_prompt_1', services);
    assert.ok(prompt);
    assert.equal(prompt.agent, 'opencode');
    assert.equal(prompt.role, 'audit/review');
    assert.ok(prompt.goal.includes('Audit'));
  });

  await runTest('generateHermesImprovementPrompt returns structured prompt', () => {
    const prompt = promptGen.generateHermesImprovementPrompt('plan_prompt_1', services);
    assert.ok(prompt);
    assert.equal(prompt.agent, 'hermes');
    assert.equal(prompt.role, 'planning/roadmap');
  });

  await runTest('generateSecurityReviewPrompt returns structured prompt', () => {
    const prompt = promptGen.generateSecurityReviewPrompt('plan_prompt_1', services);
    assert.ok(prompt);
    assert.equal(prompt.agent, 'security');
    assert.equal(prompt.role, 'security review');
    assert.ok(prompt.goal.includes('Security review'));
  });

  await runTest('Each prompt includes goal, root cause, affected files, constraints, safety rules', () => {
    const prompts = [
      promptGen.generateCodexImprovementPrompt('plan_prompt_1', services),
      promptGen.generateOpenCodeImprovementPrompt('plan_prompt_1', services),
      promptGen.generateHermesImprovementPrompt('plan_prompt_1', services),
      promptGen.generateSecurityReviewPrompt('plan_prompt_1', services),
    ];
    for (const p of prompts) {
      assert.ok(p.goal, 'goal missing');
      assert.ok(p.rootCauseSummary, 'rootCauseSummary missing');
      assert.ok(Array.isArray(p.affectedFiles) && p.affectedFiles.length > 0, 'affectedFiles missing');
      assert.ok(Array.isArray(p.constraints) && p.constraints.length > 0, 'constraints missing');
      assert.ok(Array.isArray(p.safetyRules) && p.safetyRules.length > 0, 'safetyRules missing');
    }
  });

  await runTest('No secrets in prompts (masked)', () => {
    const prompt = promptGen.generateCodexImprovementPrompt('plan_prompt_1', services);
    const str = JSON.stringify(prompt);
    // Constraints mention TELEGRAM_TOKEN as a label (what not to log), not as a value.
    // maskSecrets only redacts patterns like TELEGRAM_TOKEN=value, not the bare label.
    assert.ok(!str.includes('TELEGRAM_TOKEN='), 'TELEGRAM_TOKEN=value should not be in prompt');
    assert.ok(!str.includes('sk-'), 'sk- patterns should not be in prompt');
    assert.ok(!str.includes('ghp_'), 'ghp_ patterns should not be in prompt');
    assert.ok(!str.includes('DATABASE_URL='), 'DATABASE_URL=value should not be in prompt');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
