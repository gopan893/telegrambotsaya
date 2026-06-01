'use strict';

const auditLog = require('../dashboard/audit-log');
const planner = require('../planner');
const guards = require('./executor-guards');
const registry = require('./executor-registry');
const store = require('./execution-store');
const utils = require('./executor-utils');

function buildAction(input = {}, base = {}) {
  const metadata = registry.getExecutor(input.type);
  const action = {
    id: input.id || utils.createId('exec_action'),
    type: input.type,
    targetType: input.targetType || base.sourceType || 'manual',
    targetId: input.targetId || base.sourceId || '',
    workspaceId: input.workspaceId || base.workspaceId,
    userId: input.userId || base.userId,
    description: input.description || metadata?.description || input.type,
    payload: input.payload || {},
    riskLevel: input.riskLevel || metadata?.riskLevel || 'medium',
    requiresApproval: input.requiresApproval !== false,
    status: input.status || 'pending_approval',
    continueOnError: Boolean(input.continueOnError)
  };
  const valid = guards.validateProposedAction(action);
  if (!valid.ok) return valid;
  const executorValid = registry.validateExecutorAction(valid.value);
  if (!executorValid.ok) return executorValid;
  return { ok: true, action: valid.value };
}

async function recordProposalAudit(action, proposal, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || 'executor',
      actorId: extra.actorId || proposal.userId,
      action,
      targetType: 'execution_proposal',
      targetId: proposal.id,
      userId: proposal.userId,
      workspaceId: proposal.workspaceId,
      actorRole: extra.actorRole || '',
      permission: extra.permission || 'write',
      decision: extra.decision || 'allowed',
      status: extra.status || 'ok',
      beforeSummary: extra.beforeSummary || '',
      afterSummary: {
        ...utils.summarizeProposal(proposal),
        proposalId: proposal.id,
        riskLevel: proposal.riskLevel
      },
      reason: extra.reason || ''
    }, services);
  } catch (_) {}
}

function estimateRisk(proposedActions = []) {
  const actions = Array.isArray(proposedActions) ? proposedActions : [];
  const explicit = actions.map(action => action.riskLevel);
  if (actions.some(action => String(action.type || '').includes('benchmark'))) explicit.push('medium');
  if (actions.some(action => action.type !== 'memory.suggest_archive' && /archive|delete|danger|shell|code/i.test(`${action.type} ${action.description}`))) explicit.push('danger');
  return utils.maxRiskLevel(explicit.length ? explicit : ['low']);
}

async function createExecutionProposal(input = {}, services = {}) {
  const userId = String(input.userId || input.actorId || '').trim();
  const workspaceId = await utils.resolveWorkspaceId(userId, input.workspaceId, services);
  const access = await guards.enforceExecutionPermission({
    actorId: input.actorId || userId,
    userId,
    workspaceId,
    permission: 'write',
    riskLevel: input.riskLevel || 'medium',
    action: 'executor/proposal_create'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const validation = guards.validateExecutionInput(input);
  if (!validation.ok) return { ok: false, reason: validation.error, status: 400 };
  const rawActions = Array.isArray(input.proposedActions) ? input.proposedActions : [];
  if (!rawActions.length) return { ok: false, reason: 'PROPOSED_ACTIONS_REQUIRED', status: 400 };

  const actions = [];
  for (const rawAction of rawActions.slice(0, 20)) {
    const built = buildAction(rawAction, { userId, workspaceId, sourceType: validation.value.sourceType, sourceId: validation.value.sourceId });
    if (!built.ok) return { ok: false, reason: built.error, status: 400 };
    actions.push(built.action);
  }

  const riskLevel = estimateRisk(actions);
  const now = utils.nowIso();
  const proposal = {
    id: input.id || utils.createId('exec'),
    workspaceId,
    userId,
    sourceType: validation.value.sourceType,
    sourceId: validation.value.sourceId,
    title: validation.value.title,
    description: validation.value.description,
    proposedActions: actions,
    riskLevel,
    status: utils.normalizeProposalStatus(input.status || 'pending_approval'),
    requiresApproval: true,
    approvalToken: utils.createApprovalToken(),
    approvedBy: '',
    approvedAt: null,
    rejectedBy: '',
    rejectedAt: null,
    expiresAt: input.expiresAt || utils.expiryIso(),
    resultSummary: '',
    errorSummary: '',
    createdAt: now,
    updatedAt: now
  };
  await store.upsertExecutionItem(store.EXECUTOR_PROPOSALS_KEY, proposal, services);
  await recordProposalAudit('executor/proposal_created', proposal, services, access);
  await recordProposalAudit('executor/approval_requested', proposal, services, access);
  return { ok: true, proposal };
}

async function proposeFromPlannerTask(taskId, options = {}, services = {}) {
  const task = await planner.taskOrchestrator.getTask(taskId, services);
  if (!task) return { ok: false, reason: 'TASK_NOT_FOUND', status: 404 };
  const actionType = options.actionType || (options.blockedReason ? 'planner.task.mark_blocked' : 'planner.task.mark_done');
  const payload = actionType === 'planner.task.mark_blocked'
    ? { taskId, reason: options.blockedReason || options.reason || 'Blocked via approved execution.' }
    : { taskId };
  return createExecutionProposal({
    actorId: options.actorId || task.userId,
    userId: task.userId,
    workspaceId: options.workspaceId || task.workspaceId,
    sourceType: 'planner_task',
    sourceId: task.id,
    title: options.title || `Execute task: ${task.title}`,
    description: options.description || `Human-approved proposal for planner task "${task.title}".`,
    proposedActions: [{
      type: actionType,
      targetType: 'planner_task',
      targetId: task.id,
      description: actionType === 'planner.task.mark_done' ? `Mark task done: ${task.title}` : `Mark task blocked: ${task.title}`,
      payload,
      riskLevel: 'medium'
    }]
  }, services);
}

async function getGoal(userId, goalId, services = {}) {
  const repos = services.storageManager?.getRepositories?.();
  if (repos?.goals?.getGoalById) return repos.goals.getGoalById(userId, goalId);
  const goals = services.aiOS?.goalManager?.listGoals?.(userId, {}, services) || [];
  return (await goals).find(goal => String(goal.id) === String(goalId)) || null;
}

async function proposeFromGoal(goalId, options = {}, services = {}) {
  const userId = String(options.userId || options.actorId || '').trim();
  const goal = await getGoal(userId, goalId, services);
  const workspaceId = options.workspaceId || goal?.workspaceId || goal?.metadata?.workspaceId;
  return createExecutionProposal({
    actorId: options.actorId || userId,
    userId,
    workspaceId,
    sourceType: 'goal',
    sourceId: goalId,
    title: options.title || `Update goal progress: ${goal?.title || goalId}`,
    description: options.description || 'Human-approved proposal to update goal progress.',
    proposedActions: [{
      type: 'goal.progress.update',
      targetType: 'goal',
      targetId: goalId,
      description: `Update progress for goal ${goal?.title || goalId}`,
      payload: { goalId, progress: Number(options.progress ?? goal?.progress ?? 10) },
      riskLevel: 'medium'
    }]
  }, services);
}

async function proposeFromWorkflow(workflowId, options = {}, services = {}) {
  const userId = String(options.userId || options.actorId || '').trim();
  const actionType = options.stepNumber ? 'workflow.step.done' : 'workflow.step.add';
  return createExecutionProposal({
    actorId: options.actorId || userId,
    userId,
    workspaceId: options.workspaceId,
    sourceType: 'workflow',
    sourceId: workflowId,
    title: options.title || `Workflow action: ${workflowId}`,
    description: options.description || 'Human-approved workflow proposal.',
    proposedActions: [{
      type: actionType,
      targetType: 'workflow',
      targetId: workflowId,
      description: actionType === 'workflow.step.done' ? `Mark workflow step ${options.stepNumber} done` : 'Add workflow step',
      payload: {
        workflowId,
        stepNumber: options.stepNumber,
        title: options.stepTitle || options.title || 'Approved executor step',
        description: options.stepDescription || ''
      },
      riskLevel: 'medium'
    }]
  }, services);
}

function summarizeProposal(proposal = {}) {
  const actions = proposal.proposedActions || [];
  return [
    `${proposal.id} - ${proposal.title}`,
    `Status: ${proposal.status}`,
    `Risk: ${proposal.riskLevel}`,
    `Source: ${proposal.sourceType}${proposal.sourceId ? `/${proposal.sourceId}` : ''}`,
    `Actions: ${actions.length}`,
    ...actions.map((action, index) => `${index + 1}. ${action.type} -> ${action.description}`)
  ].join('\n');
}

async function expireOldProposals(services = {}) {
  const proposals = await store.loadExecutionData(store.EXECUTOR_PROPOSALS_KEY, [], services);
  let expired = 0;
  const next = (Array.isArray(proposals) ? proposals : []).map(proposal => {
    if (['pending_approval', 'draft'].includes(proposal.status) && utils.isExpired(proposal)) {
      expired += 1;
      return { ...proposal, status: 'expired', updatedAt: utils.nowIso() };
    }
    return proposal;
  });
  if (expired) await store.saveExecutionData(store.EXECUTOR_PROPOSALS_KEY, next, services);
  return { ok: true, expired };
}

async function answerWithExecutorContext(userId, chatId, text, msg, services = {}) {
  const detection = utils.detectExecutorNaturalNeed(text);
  if (!detection.shouldUse) return { handled: false, reason: detection.reason };
  const send = services.sendChunkedMessage || services.safeSendMessage;
  if (typeof send !== 'function') return { handled: false, reason: 'sender_missing' };
  const taskId = utils.extractLikelyTaskId(text);
  let answer = '';
  if (taskId) {
    const result = await proposeFromPlannerTask(taskId, { actorId: userId }, services);
    answer = result.ok
      ? `Saya menyiapkan proposal eksekusi.\n\n${summarizeProposal(result.proposal)}\n\nApproval tidak menjalankan aksi otomatis. Gunakan /approve ${result.proposal.id}, lalu /runexec ${result.proposal.id}.`
      : `Belum bisa membuat proposal eksekusi: ${result.reason}`;
  } else {
    answer = 'Saya bisa menyiapkan proposal eksekusi, tetapi tidak akan menjalankan aksi tanpa approval. Kirim /propose <taskId>, lalu /approve <proposalId> dan /runexec <proposalId>.';
  }
  await send(chatId, answer, { reply_to_message_id: msg?.message_id });
  return { handled: true, answer, type: 'executor', confidence: detection.confidence };
}

module.exports = {
  answerWithExecutorContext,
  createExecutionProposal,
  estimateRisk,
  expireOldProposals,
  proposeFromGoal,
  proposeFromPlannerTask,
  proposeFromWorkflow,
  summarizeProposal
};
