'use strict';

const assert = require('assert');
const { ImprovementStore } = require('../src/improvement/improvement-store');

async function runTests() {
  console.log('=== test-improvement-plan-generator.js ===');
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

  const planGen = require('../src/improvement/improvement-plan-generator');
  const store = new ImprovementStore();
  const services = { store };

  await runTest('createImprovementPlan creates plan with correct fields', () => {
    const plan = planGen.createImprovementPlan({
      title: 'Fix dashboard routing',
      summary: 'Dashboard tabs not routing correctly',
      proposedSteps: ['Analyze routing logic', 'Fix tab mapping', 'Add test'],
      targetModules: ['dashboard'],
      riskLevel: 'medium'
    }, services);
    assert.ok(plan, 'plan should be created');
    assert.ok(plan.id, 'should have id');
    assert.equal(plan.title, 'Fix dashboard routing');
    assert.ok(Array.isArray(plan.proposedSteps));
    assert.equal(plan.proposedSteps.length, 3);
    assert.ok(plan.recommendedAgent, 'should recommend an agent');
  });

  await runTest('createImprovementPlanFromWeakness creates from weakness', () => {
    store.add('weaknesses', {
      id: 'w_plan_1', title: 'Deploy failure on staging',
      targetModule: 'deploy', severity: 'critical', workspaceId: 'w1'
    });
    const plan = planGen.createImprovementPlanFromWeakness('w_plan_1', services);
    assert.ok(plan, 'plan should be created');
    assert.ok(plan.title.includes('Deploy failure'), 'should reference weakness');
    assert.ok(Array.isArray(plan.sourceWeaknessIds));
    assert.ok(plan.sourceWeaknessIds.includes('w_plan_1'));
    assert.ok(Array.isArray(plan.proposedSteps), 'should have steps');
  });

  await runTest('createImprovementPlanFromPattern creates from pattern', () => {
    const pattern = {
      title: 'Repeated cost spikes',
      summary: 'Multiple cost spikes detected',
      targetModules: ['cost'],
      riskLevel: 'high',
      suggestedSteps: ['Audit token usage', 'Optimize prompts']
    };
    const plan = planGen.createImprovementPlanFromPattern(pattern, services);
    assert.ok(plan, 'plan should be created');
    assert.ok(plan.title.includes('Pattern improvement'), 'should reference pattern');
  });

  await runTest('recommendImprovementAgent recommends correct agent', () => {
    // 'secret' keyword maps to security agent
    const securityPlan = { title: 'Secret rotation', proposedSteps: ['Rotate credentials'], targetModules: ['security'], riskLevel: 'high' };
    assert.equal(planGen.recommendImprovementAgent(securityPlan), 'security');

    const deployPlan = { title: 'Render deployment setup', proposedSteps: ['Update deploy script'], targetModules: ['deploy'], riskLevel: 'medium' };
    assert.equal(planGen.recommendImprovementAgent(deployPlan), 'ops');

    const normalPlan = { title: 'Minor fix', proposedSteps: ['Fix'], targetModules: ['dashboard'], riskLevel: 'low' };
    const agent = planGen.recommendImprovementAgent(normalPlan);
    assert.ok(['codex', 'opencode', 'hermes'].includes(agent), 'should be a valid agent');
  });

  await runTest('validateImprovementPlan validates plan', () => {
    const validPlan = {
      title: 'Test plan',
      proposedSteps: ['Step 1'],
      recommendedAgent: 'codex',
      riskLevel: 'low',
      status: 'draft',
      targetModules: ['dashboard']
    };
    const result = planGen.validateImprovementPlan(validPlan);
    assert.ok(result.valid, 'valid plan should pass');
    assert.equal(result.errors.length, 0);
  });

  await runTest('validateImprovementPlan catches invalid plan', () => {
    const result = planGen.validateImprovementPlan({});
    assert.ok(!result.valid, 'invalid plan should fail');
    assert.ok(result.errors.length > 0);
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
