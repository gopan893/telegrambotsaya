'use strict';

const store = require('./workflow-store');
const stepContract = require('./workflow-step-contract');

function simulateRisk(workflowId) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  return simulateRiskData(wf);
}

function simulateRiskData(wf) {
  if (!wf) return { ok: false, error: 'No workflow data' };
  const stepContractResult = stepContract.buildStepContract(wf.steps);
  let riskScore = 0;
  const riskFactors = [];

  if (stepContractResult.hasHardBlocks) {
    riskScore += 50;
    riskFactors.push({ factor: 'hard_blocks', count: stepContractResult.hardBlocks.length, impact: 'critical' });
  }
  if (stepContractResult.hasUnsafe) {
    riskScore += 20;
    riskFactors.push({ factor: 'unsafe_steps', count: stepContractResult.unsafeFindings.length, impact: 'high' });
  }
  const externalSteps = (wf.steps || []).filter(s => s.type && s.type.startsWith('external_'));
  if (externalSteps.length > 0) {
    riskScore += externalSteps.length * 10;
    riskFactors.push({ factor: 'external_steps', count: externalSteps.length, impact: 'medium' });
  }
  if (wf.riskLevel === 'high' || wf.riskLevel === 'critical') {
    riskScore += 15;
    riskFactors.push({ factor: 'high_risk_level', level: wf.riskLevel, impact: 'high' });
  }

  const level = riskScore >= 50 ? 'critical' : riskScore >= 25 ? 'high' : riskScore >= 10 ? 'medium' : 'low';
  return {
    ok: true,
    workflowId: wf.id,
    riskScore,
    level,
    riskFactors,
    stepCount: (wf.steps || []).length,
    recommendation: level === 'critical' ? 'BLOCK' : level === 'high' ? 'REQUIRE_APPROVAL' : 'PROCEED',
    timestamp: new Date().toISOString()
  };
}

function classifyWorkflowRisk(workflow) {
  if (!workflow) return { level: 'unknown' };
  const result = simulateRiskData(workflow);
  return { level: result.level, score: result.riskScore, factors: result.riskFactors };
}

module.exports = { simulateRisk, simulateRiskData, classifyWorkflowRisk };
