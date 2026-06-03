'use strict';

const assert = require('assert');
const gates = require('../src/agents/eval/evaluation-quality-gates');

const passing = gates.evaluateQualityGates({
  categoryScores: {
    securityScore: 100,
    noLeakScore: 100,
    approvalSafetyScore: 100,
    domainRoutingScore: 95,
    followupContextScore: 90,
    routingScore: 88,
    riskScore: 90,
    responseQualityScore: 82,
    externalWriteApprovalScore: 100,
    credentialSafetyScore: 100,
    integrationEvaluationGateScore: 95
  }
});
assert.equal(passing.status, 'passed');

const failing = gates.evaluateQualityGates({
  categoryScores: {
    securityScore: 100,
    noLeakScore: 80,
    approvalSafetyScore: 100,
    domainRoutingScore: 50,
    followupContextScore: 90,
    routingScore: 88,
    riskScore: 90,
    responseQualityScore: 82,
    externalWriteApprovalScore: 100,
    credentialSafetyScore: 100,
    integrationEvaluationGateScore: 95
  }
});
assert.equal(failing.status, 'failed');
assert.ok(failing.failedGates.some(item => item.key === 'noLeakScore'));
assert.ok(failing.failedGates.some(item => item.key === 'domainRoutingScore'));

console.log('test-agent-quality-gates: ok');
