'use strict';

function createExecutorSafetyGuard(store, services) {
  async function runExecutorGuardCheck(guard, ctx, svc) {
    switch (guard.id) {
      case 'gd_executor_proposal_no_auto_run':
        return checkNoAutoRun(svc);
      case 'gd_executor_no_self_approve':
        return checkNoSelfApprove(svc);
      default:
        return { status: 'warning', summary: 'No check for guard: ' + guard.id, details: '' };
    }
  }

  async function checkNoAutoRun(svc) {
    const executorCode = svc.executorCode || '';
    if (!executorCode) {
      return { status: 'warning', summary: 'Cannot check: executor code not available', details: '' };
    }
    const hasCreateProposal = executorCode.indexOf('createProposal') !== -1;
    const hasRunProposal = executorCode.indexOf('runProposal') !== -1 || executorCode.indexOf('runProposalById') !== -1;
    const createCallsRun = hasCreateProposal && hasRunProposal;
    if (!createCallsRun) {
      return { status: 'passed', summary: 'No auto-run pattern detected', details: '' };
    }
    const createFollowedByRun = executorCode.indexOf('createProposal') < executorCode.indexOf('runProposal');
    return {
      status: createFollowedByRun ? 'warning' : 'passed',
      summary: createFollowedByRun ? 'createProposal and runProposal both present - verify no auto-run' : 'No auto-run risk detected',
      details: 'createProposal: ' + hasCreateProposal + ', runProposal: ' + hasRunProposal
    };
  }

  async function checkNoSelfApprove(svc) {
    const executorCode = svc.executorCode || '';
    if (!executorCode) {
      return { status: 'warning', summary: 'Cannot check: executor code not available', details: '' };
    }
    const hasApprove = executorCode.indexOf('approveProposal') !== -1 || executorCode.indexOf('.approve') !== -1;
    const proposerCheck = svc.proposerCheck !== false;
    const hasActorCheck = executorCode.indexOf('actorId') !== -1 || executorCode.indexOf('proposerId') !== -1;
    const issues = [];
    if (!hasActorCheck) issues.push('no actor/proposer ID check in approval');
    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      summary: issues.length === 0 ? 'Self-approve protections appear intact' : 'Potential self-approve risk: ' + issues.join(', '),
      details: 'hasApprove: ' + hasApprove + ', proposerCheck: ' + proposerCheck + ', hasActorCheck: ' + hasActorCheck
    };
  }

  return { runExecutorGuardCheck };
}

module.exports = { createExecutorSafetyGuard };
