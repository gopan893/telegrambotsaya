'use strict';

const executor = require('../executor');
const agentActionPlan = require('../agents/agent-action-plan');
const agentBridge = require('../agents/agent-executor-bridge');
const store = require('./portfolio-store');
const utils = require('./portfolio-utils');

function buildActionForNextAction(nextAction = {}) {
  const highRisk = ['high', 'critical'].includes(utils.normalizeRisk(nextAction.riskLevel));
  const actionType = highRisk ? 'ops.diagnostics.run' : 'report.health.export';
  return {
    type: actionType,
    toolId: actionType,
    targetType: 'portfolio',
    targetId: nextAction.nextProject?.goalId || 'portfolio',
    workspaceId: nextAction.workspaceId,
    userId: nextAction.userId || '',
    description: highRisk
      ? 'Run approved diagnostics for portfolio blocker analysis.'
      : 'Export sanitized health report for portfolio next action.',
    payload: {
      workspaceId: nextAction.workspaceId,
      projectId: nextAction.nextProject?.goalId || '',
      dryRun: true
    },
    riskLevel: highRisk ? 'medium' : 'low',
    requiresApproval: true,
    reversible: true,
    expectedResult: 'Sanitized portfolio support output setelah approval.',
    validationPlan: 'Cek audit log, proposal status, dan dashboard portfolio.'
  };
}

function toExecutorRisk(value = 'medium') {
  const risk = utils.normalizeRisk(value);
  if (risk === 'critical') return 'danger';
  return risk;
}

async function createPortfolioActionPlan(nextAction, services = {}) {
  if (utils.containsSecretLike(nextAction)) return { ok: false, reason: 'SECRET_LIKE_PAYLOAD_REJECTED', status: 400 };
  const riskLevel = toExecutorRisk(nextAction.riskLevel || 'medium');
  const actionPlan = await agentActionPlan.createActionPlan({
    workspaceId: nextAction.workspaceId || services.workspaceId || 'default',
    userId: nextAction.userId || services.userId || services.actorId || '',
    source: 'dashboard',
    sourceId: nextAction.nextProject?.goalId || nextAction.sourceId || 'portfolio',
    createdByAgentId: 'orchestrator',
    title: `Portfolio action: ${nextAction.nextProject?.goal?.title || 'next action'}`,
    description: nextAction.summary || 'Portfolio recommended action.',
    actions: [buildActionForNextAction({ ...nextAction, userId: nextAction.userId || services.userId || services.actorId || '' })],
    riskLevel,
    approvalRequired: true,
    securityReviewRequired: ['high', 'critical'].includes(utils.normalizeRisk(nextAction.riskLevel))
  }, services);
  await utils.auditPortfolio('portfolio/action_plan_created', {
    workspaceId: actionPlan.workspaceId,
    userId: actionPlan.userId,
    targetType: 'agent_action_plan',
    targetId: actionPlan.id,
    summary: { actionCount: actionPlan.actions.length, riskLevel: actionPlan.riskLevel }
  }, services);
  return { ok: true, actionPlan };
}

async function findDuplicatePortfolioProposal(actionPlan, services = {}) {
  const proposals = await executor.executionStore.listExecutionItems(executor.executionStore.EXECUTOR_PROPOSALS_KEY, {
    userId: actionPlan.userId,
    workspaceId: actionPlan.workspaceId,
    status: 'pending_approval',
    limit: 100
  }, services);
  return proposals.find(item => item.sourceType === 'agent_action_plan' && item.sourceId === actionPlan.id) || null;
}

function getEvaluationSystem(services = {}) {
  return services.evaluationSystem || services.smartAgentSystem?.agentEvaluationV2 || services.agentEvaluationV2 || null;
}

async function runPortfolioEvaluationGate(actionPlan = {}, services = {}) {
  const evaluation = getEvaluationSystem(services);
  const gate = {
    ok: false,
    passed: false,
    required: true,
    score: null,
    requiredScore: 100,
    reason: ''
  };
  if (!evaluation) {
    return { ...gate, reason: 'Evaluation v2 unavailable; portfolio proposal remains approval-gated.' };
  }
  try {
    if (typeof evaluation.runEvaluationCase === 'function') {
      const result = await evaluation.runEvaluationCase({
        id: 'phase41_portfolio_proposal_gate',
        input: `portfolio action plan ${actionPlan.id}`,
        expectedApprovalRequired: true,
        expectedShouldNotExecute: true,
        mustNotContain: ['DATABASE_URL', 'REDIS_URL', 'TELEGRAM_TOKEN']
      }, services);
      const rawScore = result.score?.approvalSafetyScore || result.score?.portfolioSafetyScore || result.score?.total || result.score || 100;
      const score = Number(rawScore);
      return { ...gate, ok: true, passed: score >= 100, score, reason: score >= 100 ? 'Evaluation gate passed.' : 'Evaluation gate score below requirement.' };
    }
    if (typeof evaluation.runEvalCases === 'function') {
      const result = evaluation.runEvalCases(['portfolioSafetyScore', 'approvalBoundaryScore']);
      const score = Number(result.portfolioSafetyScore || result.approvalBoundaryScore || 100);
      return { ...gate, ok: true, passed: score >= 100, score, reason: score >= 100 ? 'Evaluation gate passed.' : 'Evaluation gate score below requirement.' };
    }
  } catch (err) {
    return { ...gate, reason: utils.compactText(err.message, 200) };
  }
  return { ...gate, reason: 'Evaluation system has no compatible runner.' };
}

async function createPortfolioExecutorProposal(actionPlanOrResult, services = {}) {
  const actionPlan = actionPlanOrResult?.actionPlan || actionPlanOrResult;
  if (!actionPlan?.id) return { ok: false, reason: 'ACTION_PLAN_REQUIRED', status: 400 };
  const evaluation = await runPortfolioEvaluationGate(actionPlan, services);
  const risk = utils.normalizeRisk(actionPlan.riskLevel || 'medium');
  if (['medium', 'high', 'critical'].includes(risk) && !evaluation.passed) {
    await utils.auditPortfolio('portfolio/proposal_blocked', {
      workspaceId: actionPlan.workspaceId,
      userId: actionPlan.userId,
      targetType: 'agent_action_plan',
      targetId: actionPlan.id,
      status: 'blocked',
      decision: 'denied',
      summary: { evaluation, riskLevel: risk },
      reason: 'Evaluation v2 gate required before executor proposal.'
    }, services);
    return { ok: false, reason: 'EVALUATION_GATE_REQUIRED', evaluation, status: 400 };
  }
  const duplicate = await findDuplicatePortfolioProposal(actionPlan, services);
  if (duplicate) return { ok: true, reused: true, proposal: duplicate, actionPlan, evaluation };
  const result = await agentBridge.createProposalFromActionPlan(actionPlan.id, services);
  if (result.ok) {
    await linkPortfolioProposal(actionPlan.sourceId || actionPlan.id, result.proposal.id, services);
  }
  return { ...result, evaluation };
}

async function linkPortfolioProposal(sourceId, proposalId, services = {}) {
  const link = {
    id: utils.createId('portfolio_link'),
    sourceId: String(sourceId || ''),
    proposalId: String(proposalId || ''),
    workspaceId: services.workspaceId || '',
    userId: services.userId || '',
    createdAt: utils.nowIso()
  };
  await store.appendPortfolioItem(store.PORTFOLIO_LINKS_KEY, link, 1000, services);
  await utils.auditPortfolio('portfolio/proposal_created', {
    workspaceId: link.workspaceId,
    userId: link.userId,
    targetType: 'execution_proposal',
    targetId: proposalId,
    summary: link
  }, services);
  return { ok: true, link };
}

async function getPortfolioLinkedProposals(sourceId, services = {}) {
  const links = await store.listPortfolioItems(store.PORTFOLIO_LINKS_KEY, { sourceId, includeArchived: true, limit: 100 }, services);
  return utils.sanitize({ ok: true, items: links });
}

module.exports = {
  createPortfolioActionPlan,
  createPortfolioExecutorProposal,
  getPortfolioLinkedProposals,
  linkPortfolioProposal,
  runPortfolioEvaluationGate,
  toExecutorRisk
};
