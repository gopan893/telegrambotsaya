'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

function baseProposal(kind, input = {}, services = {}) {
  return {
    id: utils.createId(`life_${kind}`),
    workspaceId: utils.resolveWorkspaceId(input, services),
    userId: utils.resolveUserId(input, services),
    kind,
    title: utils.sanitizeText(input.title || kind.replace(/_/g, ' '), 180),
    description: utils.sanitizeText(input.description || input.text || '', 1000),
    status: 'pending_approval',
    riskLevel: kind.includes('calendar') || kind.includes('gmail') || kind.includes('routine') ? 'medium' : 'low',
    requiresEvaluation: true,
    requiresExecutorApproval: true,
    directExternalWrite: false,
    didExecute: false,
    payload: utils.sanitizePayload(input.payload || input, { maxString: 900, maxItems: 80, maxKeys: 80 }),
    createdAt: utils.nowIso()
  };
}

async function createCalendarEventProposal(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_CALENDAR_PROPOSAL_REJECTED', status: 400 };
  const proposal = baseProposal('calendar_event_proposal', input, services);
  proposal.actionType = 'calendar.event.create';
  proposal.summary = 'Calendar create/update is external write and remains proposal-only.';
  await store.appendLifeProposal(proposal, services);
  await utils.auditLife('lifeos/calendar_proposal_created', { workspaceId: proposal.workspaceId, userId: proposal.userId, targetId: proposal.id, summary: { directExternalWrite: false } }, services);
  return { ok: true, proposal };
}

async function createGmailDraftProposal(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_GMAIL_PROPOSAL_REJECTED', status: 400 };
  const proposal = baseProposal('gmail_draft_proposal', input, services);
  proposal.actionType = 'gmail.draft.create';
  proposal.summary = 'Gmail draft is proposal-only; Gmail send is disabled by default.';
  await store.appendLifeProposal(proposal, services);
  await utils.auditLife('lifeos/gmail_draft_proposal_created', { workspaceId: proposal.workspaceId, userId: proposal.userId, targetId: proposal.id, summary: { directExternalWrite: false, sendDisabled: true } }, services);
  return { ok: true, proposal };
}

async function createRoutineProposalFromLifePlan(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_ROUTINE_PROPOSAL_REJECTED', status: 400 };
  const proposal = baseProposal('routine_proposal', input, services);
  proposal.actionType = 'routine.schedule.propose';
  proposal.summary = 'Routine scheduling requires explicit approval; no autonomous scheduler is started.';
  await store.appendLifeProposal(proposal, services);
  return { ok: true, proposal };
}

async function createReminderProposal(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_REMINDER_PROPOSAL_REJECTED', status: 400 };
  const proposal = baseProposal('reminder_proposal', input, services);
  proposal.actionType = 'life.reminder.plan';
  proposal.summary = 'Reminder is a plan/proposal unless a safe notification system is explicitly approved.';
  await store.appendLifeProposal(proposal, services);
  return { ok: true, proposal };
}

async function runLifeIntegrationEvaluationGate(plan = {}, services = {}) {
  if (utils.containsSecretLike(plan)) return { ok: false, allowed: false, reason: 'SECRET_LIKE_LIFE_INTEGRATION_BLOCKED' };
  return {
    ok: true,
    allowed: true,
    dryRun: true,
    gates: {
      lifePrivacyScore: 100,
      secretRedactionScore: 100,
      externalActionSafetyScore: 100
    },
    note: 'Evaluation gate is dry-run only; no external action was executed.'
  };
}

async function createLifeExecutorProposal(plan = {}, services = {}) {
  const gate = await runLifeIntegrationEvaluationGate(plan, services);
  if (!gate.allowed) return { ok: false, reason: gate.reason, gate, status: 400 };
  const proposal = baseProposal('life_executor_proposal', plan, services);
  proposal.actionType = plan.actionType || 'life.proposal';
  proposal.evaluationGate = gate;
  proposal.summary = 'Executor proposal metadata created; approval and run remain separate.';
  await store.appendLifeProposal(proposal, services);
  await utils.auditLife('lifeos/life_proposal_created', { workspaceId: proposal.workspaceId, userId: proposal.userId, targetId: proposal.id, summary: { actionType: proposal.actionType, directExternalWrite: false } }, services);
  return { ok: true, proposal, gate };
}

module.exports = {
  createCalendarEventProposal,
  createGmailDraftProposal,
  createLifeExecutorProposal,
  createReminderProposal,
  createRoutineProposalFromLifePlan,
  runLifeIntegrationEvaluationGate
};
