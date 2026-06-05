'use strict';

const utils = require('./githubops-utils');
const store = require('./githubops-store');

function evaluateReleaseReadiness(proposals, workflowStatus) {
  const gates = [];

  const pushApproved = proposals.pushProposals && proposals.pushProposals.some(p => p.executorApproval === 'approved');
  const workflowApproved = proposals.workflowProposals && proposals.workflowProposals.some(p => p.executorApproval === 'approved');
  const workflowPassed = workflowStatus === 'success';

  if (!pushApproved) gates.push({ gate: 'PUSH_APPROVAL', passed: false, detail: 'No approved push proposal' });
  else gates.push({ gate: 'PUSH_APPROVAL', passed: true });
  if (!workflowApproved) gates.push({ gate: 'WORKFLOW_APPROVAL', passed: false, detail: 'No approved workflow run proposal' });
  else gates.push({ gate: 'WORKFLOW_APPROVAL', passed: true });
  if (!workflowPassed) gates.push({ gate: 'CI_PASS', passed: false, detail: 'CI has not passed' });
  else gates.push({ gate: 'CI_PASS', passed: true });

  const allPassed = gates.every(g => g.passed);
  const gate = {
    id: utils.shortId(),
    gates,
    allPassed,
    status: allPassed ? 'release_ready' : 'blocked',
    timestamp: utils.now()
  };

  store.addReleaseGate(gate);
  return gate;
}

function buildReleaseSummary(releaseGate) {
  if (!releaseGate) return 'No release gate data.';
  const lines = ['## Release Gate Summary', ''];
  for (const g of (releaseGate.gates || [])) {
    lines.push(`- ${g.passed ? '✅' : '❌'} ${g.gate}${g.detail ? ': ' + g.detail : ''}`);
  }
  lines.push('');
  lines.push(`Status: **${releaseGate.allPassed ? '✅ READY FOR RELEASE' : '❌ BLOCKED'}**`);
  lines.push(`Evaluated: ${releaseGate.timestamp}`);
  return lines.join('\n');
}

module.exports = {
  evaluateReleaseReadiness,
  buildReleaseSummary
};
