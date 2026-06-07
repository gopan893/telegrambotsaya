'use strict';

const assert = require('assert');
const bridge = require('../src/portfolio/portfolio-proposal-bridge');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId, userId } = makePortfolioServices({
    evaluationSystem: {
      runEvaluationCase: async () => ({ score: { approvalSafetyScore: 0, portfolioSafetyScore: 0 } })
    }
  });
  assert.strictEqual(bridge.toExecutorRisk('critical'), 'danger');
  const secret = await bridge.createPortfolioActionPlan({
    workspaceId,
    userId,
    summary: 'token sk-xxxx',
    riskLevel: 'high'
  }, services);
  assert.strictEqual(secret.ok, false);

  const plan = await bridge.createPortfolioActionPlan({
    workspaceId,
    userId,
    riskLevel: 'critical',
    summary: 'Need safe portfolio diagnostics',
    nextProject: { goalId: 'goal_deploy', goal: { title: 'Deploy' } }
  }, services);
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.actionPlan.riskLevel, 'danger');

  const proposal = await bridge.createPortfolioExecutorProposal(plan.actionPlan, services);
  assert.strictEqual(proposal.ok, false);
  assert.strictEqual(proposal.reason, 'EVALUATION_GATE_REQUIRED');
  assert(!JSON.stringify(proposal).includes('sk-xxxx'));
  console.log('test-portfolio-proposal-bridge: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
