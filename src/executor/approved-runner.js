'use strict';

const auditLog = require('../dashboard/audit-log');
const guards = require('./executor-guards');
const registry = require('./executor-registry');
const store = require('./execution-store');
const utils = require('./executor-utils');

async function audit(action, proposal = {}, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || 'executor',
      actorId: extra.actorId || services.actorId || proposal.approvedBy || proposal.userId,
      action,
      targetType: extra.targetType || 'execution_proposal',
      targetId: extra.targetId || proposal.id,
      userId: proposal.userId,
      workspaceId: proposal.workspaceId,
      actorRole: extra.actorRole || '',
      permission: extra.permission || 'run',
      decision: extra.decision || 'allowed',
      status: extra.status || 'ok',
      beforeSummary: extra.beforeSummary || '',
      afterSummary: extra.afterSummary || utils.summarizeProposal(proposal),
      reason: extra.reason || ''
    }, services);
  } catch (_) {}
}

function rollbackNotSupportedNotice(action = {}) {
  return `Rollback otomatis belum didukung untuk ${action.type}. Gunakan aksi manual terkontrol jika perlu.`;
}

async function runAction(action = {}, services = {}) {
  const valid = registry.validateExecutorAction(action);
  if (!valid.ok) return { ok: false, actionId: action.id, actionType: action.type, error: valid.error };
  if (action.requiresApproval === false) return { ok: false, actionId: action.id, actionType: action.type, error: 'APPROVAL_REQUIRED' };
  if (/shell|code|javascript|exec|env|config/i.test(action.type)) {
    return { ok: false, actionId: action.id, actionType: action.type, error: 'ACTION_TYPE_BLOCKED' };
  }
  const result = await valid.executor.handler(action, services);
  return {
    ok: Boolean(result?.ok),
    actionId: action.id,
    actionType: action.type,
    result: guards.sanitizeExecutionResult(result?.result || result),
    error: result?.ok ? '' : (result?.error || result?.result?.reason || 'ACTION_FAILED'),
    rollback: rollbackNotSupportedNotice(action)
  };
}

function buildExecutionResult(proposal = {}, actionResults = []) {
  const failed = actionResults.filter(item => !item.ok);
  return {
    ok: failed.length === 0,
    resultSummary: failed.length
      ? `${failed.length}/${actionResults.length} action gagal.`
      : `${actionResults.length} action selesai.`,
    errorSummary: failed.map(item => `${item.actionType}: ${item.error}`).join('; '),
    actionResults
  };
}

async function markExecutionFailed(proposalId, error, services = {}) {
  const proposal = await store.getExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND' };
  const updated = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, {
    status: 'failed',
    errorSummary: utils.compactText(error?.message || error || 'Execution failed.', 400)
  }, services);
  await audit('executor/run_failed', updated, services, { status: 'failed', reason: updated.errorSummary });
  return { ok: true, proposal: updated };
}

async function runApprovedExecution(proposalId, services = {}) {
  const proposal = await store.getExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, services);
  if (!proposal) return { ok: false, reason: 'PROPOSAL_NOT_FOUND', status: 404 };
  if (proposal.status !== 'approved') return { ok: false, reason: `NOT_APPROVED_${proposal.status}`, status: 400 };
  if (utils.isExpired(proposal)) {
    const expired = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, { status: 'expired' }, services);
    return { ok: false, reason: 'PROPOSAL_EXPIRED', status: 400, proposal: expired };
  }
  const access = await guards.enforceExecutionPermission({
    actorId: services.actorId || proposal.approvedBy || proposal.userId,
    userId: proposal.userId,
    workspaceId: proposal.workspaceId,
    permission: 'approve',
    riskLevel: proposal.riskLevel,
    action: 'executor/run',
    targetId: proposal.id
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };

  const running = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, { status: 'running' }, services);
  const run = {
    id: utils.createId('run'),
    proposalId,
    workspaceId: proposal.workspaceId,
    userId: proposal.userId,
    status: 'running',
    actionResults: [],
    resultSummary: '',
    errorSummary: '',
    startedAt: utils.nowIso(),
    completedAt: null,
    createdAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  };
  await store.upsertExecutionItem(store.EXECUTOR_RUNS_KEY, run, services);
  await audit('executor/run_started', running || proposal, services, access);

  const actionResults = [];
  try {
    for (const action of proposal.proposedActions || []) {
      const actionAccess = await guards.enforceExecutionPermission({
        actorId: access.actorId,
        userId: action.userId || proposal.userId,
        workspaceId: action.workspaceId || proposal.workspaceId,
        permission: 'write',
        riskLevel: action.riskLevel,
        action: `executor/action/${action.type}`,
        targetId: action.id
      }, services);
      if (!actionAccess.ok) {
        actionResults.push({ ok: false, actionId: action.id, actionType: action.type, error: actionAccess.error });
      } else {
        const result = await runAction(action, { ...services, actorId: access.actorId, proposalId: proposal.id });
        actionResults.push(result);
        await audit(result.ok ? 'executor/action_completed' : 'executor/action_failed', proposal, services, {
          ...access,
          targetType: 'execution_action',
          targetId: action.id,
          afterSummary: { actionType: action.type, result: result.result, error: result.error },
          status: result.ok ? 'ok' : 'failed',
          reason: result.error || ''
        });
      }
      const last = actionResults[actionResults.length - 1];
      if (last && !last.ok && !action.continueOnError) break;
    }
    const result = buildExecutionResult(proposal, actionResults);
    const finalStatus = result.ok ? 'completed' : 'failed';
    const updatedRun = await store.updateExecutionItem(store.EXECUTOR_RUNS_KEY, run.id, {
      status: finalStatus,
      actionResults,
      resultSummary: result.resultSummary,
      errorSummary: result.errorSummary,
      completedAt: utils.nowIso()
    }, services);
    const updatedProposal = await store.updateExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposalId, {
      status: finalStatus,
      resultSummary: result.resultSummary,
      errorSummary: result.errorSummary
    }, services);
    await audit(result.ok ? 'executor/run_completed' : 'executor/run_failed', updatedProposal, services, {
      ...access,
      status: finalStatus,
      afterSummary: utils.summarizeRun(updatedRun)
    });
    try {
      await require('../agents/executor-result-router').routeExecutorResultToSource(proposalId, {
        ok: result.ok,
        proposal: updatedProposal,
        run: updatedRun,
        actionResults
      }, services);
    } catch (_) {}
    return { ok: result.ok, proposal: updatedProposal, run: updatedRun, actionResults };
  } catch (err) {
    await markExecutionFailed(proposalId, err, services);
    const updatedRun = await store.updateExecutionItem(store.EXECUTOR_RUNS_KEY, run.id, {
      status: 'failed',
      actionResults,
      errorSummary: utils.compactText(err.message, 400),
      completedAt: utils.nowIso()
    }, services);
    return { ok: false, reason: err.message, run: updatedRun, actionResults };
  }
}

module.exports = {
  buildExecutionResult,
  markExecutionFailed,
  rollbackNotSupportedNotice,
  runAction,
  runApprovedExecution
};
