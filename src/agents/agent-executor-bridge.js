'use strict';

const executor = require('../executor');
const actionDetector = require('./agent-action-detector');
const actionMapper = require('./agent-action-mapper');
const actionPlans = require('./agent-action-plan');
const preflightReview = require('./executor-preflight-review');
const proposalBuilder = require('./proposal-builder');
const policy = require('./agent-executor-policy');
const utils = require('./delegation-utils');

async function createActionPlanFromText(text = '', options = {}, services = {}) {
  const detection = actionDetector.detectActionIntent(text, {
    source: options.source || 'natural_chat',
    workspaceId: options.workspaceId,
    userId: options.userId
  }, services);
  if (!detection.hasActionIntent) return { ok: false, reason: detection.reason, detection };
  const mapped = actionMapper.mapIntentToActions(detection, { ...options, text });
  if (!mapped.ok) return { ok: false, reason: mapped.reason, detection };
  const agentPolicy = policy.buildPolicyDecision(options.createdByAgentId || 'orchestrator', { actions: mapped.actions });
  if (!agentPolicy.allowedToCreatePlan) return { ok: false, reason: agentPolicy.reason, detection };
  const plan = await actionPlans.createActionPlan({
    workspaceId: options.workspaceId || detection.workspaceId || 'default',
    userId: options.userId || detection.userId || '',
    source: options.source || detection.source || 'natural_chat',
    sourceId: options.sourceId || detection.targetId || '',
    createdByAgentId: options.createdByAgentId || 'orchestrator',
    title: options.title || buildTitleFromDetection(detection),
    description: options.description || text,
    actions: mapped.actions,
    riskLevel: detection.riskLevel,
    approvalRequired: true,
    securityReviewRequired: ['high', 'danger'].includes(detection.riskLevel)
  }, services);
  await utils.auditDelegation('agent_executor/action_intent_detected', {
    targetType: 'agent_action_plan',
    id: plan.id,
    workspaceId: plan.workspaceId,
    userId: plan.userId,
    actionType: detection.actionType,
    riskLevel: plan.riskLevel,
    reason: detection.reason
  }, services);
  return { ok: true, plan, detection };
}

function buildTitleFromDetection(detection = {}) {
  const labels = {
    'backup.create': 'Backup workspace',
    'backup.validate': 'Validate backup',
    'restore.run': 'Restore backup request',
    'import.run': 'Import data request',
    'planner.task.mark_done': 'Mark planner task done',
    'planner.task.mark_blocked': 'Mark planner task blocked',
    'goal.progress.update': 'Update goal progress',
    'recovery.check': 'Run recovery check',
    'integrity.check': 'Run integrity check'
  };
  return labels[detection.actionType] || `Agent action: ${detection.actionType}`;
}

async function createProposalFromActionPlan(actionPlanId, services = {}) {
  const plan = await actionPlans.getActionPlan(actionPlanId, services);
  if (!plan) return { ok: false, reason: 'ACTION_PLAN_NOT_FOUND', status: 404 };
  const review = await preflightReview.runExecutorPreflight(plan, services);
  await utils.auditDelegation('agent_executor/preflight_run', {
    targetType: 'agent_action_plan',
    id: plan.id,
    workspaceId: plan.workspaceId,
    userId: plan.userId,
    riskLevel: review.riskLevel,
    blockers: review.blockers,
    warnings: review.warnings,
    decision: review.allowedToPropose ? 'allowed' : 'denied',
    status: review.allowedToPropose ? 'ok' : 'blocked'
  }, services);
  if (!review.allowedToPropose) return { ok: false, reason: review.blockers.join(';') || 'PREFLIGHT_BLOCKED', preflight: review, status: 400 };
  if (review.duplicateProposalId) {
    const duplicate = await executor.executionStore.getExecutionItem(executor.executionStore.EXECUTOR_PROPOSALS_KEY, review.duplicateProposalId, services);
    if (duplicate) {
      const updated = await actionPlans.updateActionPlan(plan.id, {
        status: 'proposal_created',
        executorProposalId: duplicate.id
      }, services);
      await utils.auditDelegation('agent_executor/duplicate_proposal_reused', {
        targetType: 'execution_proposal',
        id: duplicate.id,
        workspaceId: plan.workspaceId,
        userId: plan.userId
      }, services);
      return { ok: true, reused: true, actionPlan: updated, proposal: duplicate, preflight: review };
    }
  }
  const payload = proposalBuilder.buildProposalPayload(plan, review, { actorId: services.actorId || plan.userId });
  const result = await executor.executionPlanner.createExecutionProposal(payload, services);
  if (!result.ok) return { ...result, preflight: review };
  const updated = await actionPlans.updateActionPlan(plan.id, {
    status: 'proposal_created',
    executorProposalId: result.proposal.id
  }, services);
  await utils.auditDelegation('agent_executor/proposal_created', {
    targetType: 'execution_proposal',
    id: result.proposal.id,
    workspaceId: plan.workspaceId,
    userId: plan.userId,
    actionPlanId: plan.id,
    riskLevel: result.proposal.riskLevel
  }, services);
  return { ok: true, actionPlan: updated, proposal: result.proposal, preflight: review };
}

async function createProposalFromDecision(decisionId, options = {}, services = {}) {
  const decision = await require('./decision-store').getDecisionRecord(decisionId, services);
  if (!decision) return { ok: false, reason: 'DECISION_NOT_FOUND', status: 404 };
  const text = options.text || decision.recommendation?.recommendation || decision.question || decision.title || 'Apply decision';
  const result = await createActionPlanFromText(text, {
    workspaceId: options.workspaceId || decision.workspaceId,
    userId: options.userId || decision.userId,
    source: 'decision',
    sourceId: decision.id,
    createdByAgentId: options.createdByAgentId || 'executor',
    title: options.title || `Proposal from decision: ${decision.title || decision.id}`,
    description: decision.question || text
  }, services);
  if (!result.ok) return result;
  return createProposalFromActionPlan(result.plan.id, services);
}

async function createProposalFromCouncil(sessionId, options = {}, services = {}) {
  const council = require('./council-engine');
  const session = await council.getSession?.(sessionId, services) || null;
  const text = options.text || session?.finalSummary || session?.topic || options.topic || 'Create approved proposal from council result';
  const plan = await createActionPlanFromText(text, {
    workspaceId: options.workspaceId || session?.workspaceId || 'default',
    userId: options.userId || session?.userId || '',
    source: 'council',
    sourceId: sessionId,
    createdByAgentId: 'executor',
    title: options.title || `Proposal from council: ${sessionId}`,
    description: text
  }, services);
  if (!plan.ok) return plan;
  return createProposalFromActionPlan(plan.plan.id, services);
}

async function createProposalFromDelegation(delegationId, options = {}, services = {}) {
  const session = await require('./delegation-engine').getDelegationSession(delegationId, services);
  if (!session) return { ok: false, reason: 'DELEGATION_NOT_FOUND', status: 404 };
  const text = options.text || session.finalSummary || session.goal || session.originalMessageSummary || 'Create approved proposal from delegation result';
  const plan = await createActionPlanFromText(text, {
    workspaceId: options.workspaceId || session.workspaceId,
    userId: options.userId || session.userId,
    source: 'delegation',
    sourceId: session.id,
    createdByAgentId: 'executor',
    title: options.title || `Proposal from delegation: ${session.goal || session.id}`,
    description: text
  }, services);
  if (!plan.ok) return plan;
  return createProposalFromActionPlan(plan.plan.id, services);
}

async function createProposalFromAgentTask(taskId, options = {}, services = {}) {
  const task = await require('./agent-task-store').getTask(taskId, services);
  if (!task) return { ok: false, reason: 'AGENT_TASK_NOT_FOUND', status: 404 };
  const text = options.text || task.resultSummary || task.description || task.title;
  const plan = await createActionPlanFromText(text, {
    workspaceId: options.workspaceId || task.workspaceId,
    userId: options.userId || task.userId,
    source: 'agent_task',
    sourceId: task.id,
    createdByAgentId: 'executor',
    title: options.title || `Proposal from agent task: ${task.title}`,
    description: text
  }, services);
  if (!plan.ok) return plan;
  return createProposalFromActionPlan(plan.plan.id, services);
}

async function createProposalFromPlannerTask(taskId, options = {}, services = {}) {
  const result = await executor.executionPlanner.proposeFromPlannerTask(taskId, options, services);
  if (result.ok) {
    await linkProposalToSource(result.proposal.id, 'planner_task', taskId, services);
  }
  return result;
}

async function linkProposalToSource(proposalId, sourceType, sourceId, services = {}) {
  await utils.auditDelegation('agent_executor/source_linked', {
    targetType: 'execution_proposal',
    id: proposalId,
    sourceType,
    sourceId,
    workspaceId: services.workspaceId || 'default',
    userId: services.userId || ''
  }, services);
  return { ok: true, proposalId, sourceType, sourceId };
}

async function createProposalFromNaturalText(text = '', options = {}, services = {}) {
  const plan = await createActionPlanFromText(text, options, services);
  if (!plan.ok) return plan;
  const proposal = await createProposalFromActionPlan(plan.plan.id, services);
  return { ...proposal, detection: plan.detection, actionPlan: proposal.actionPlan || plan.plan };
}

module.exports = {
  createActionPlanFromText,
  createProposalFromActionPlan,
  createProposalFromAgentTask,
  createProposalFromCouncil,
  createProposalFromDecision,
  createProposalFromDelegation,
  createProposalFromNaturalText,
  createProposalFromPlannerTask,
  linkProposalToSource
};
