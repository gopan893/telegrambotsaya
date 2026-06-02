'use strict';

const agentRouter = require('./agent-router');
const assignment = require('./agent-assignment');
const aggregator = require('./agent-result-aggregator');
const delegationMemory = require('./delegation-memory');
const handoffManager = require('./agent-handoff-manager');
const taskQueue = require('./agent-task-queue');
const taskRunner = require('./agent-task-runner');
const store = require('./agent-task-store');
const utils = require('./delegation-utils');

const COMPLEX_TRIGGER = /\b(bagi\s+tugas|pecah\s+tugas|delegasi|delegate|kerjakan\s+rencana|susun\s+implementasi|buat\s+prompt\s+phase|external\s+integration|rencana\s+phase|roadmap\s+implementasi|dashboard\s+agent)\b/i;
const SIMPLE_SKIP = /^(halo|hai|hi|hello|makasih|terima kasih|ok|oke|sip)$/i;
const EMOTIONAL_ONLY = /\b(sedih|capek|lelah|pusing|cemas|takut|sendiri|kesepian)\b/i;

function shouldTriggerDelegation(message = '', context = {}, routerPolicy = {}, councilResult = {}, services = {}) {
  const text = String(message || '').trim();
  if (!text || SIMPLE_SKIP.test(text)) return { needed: false, reason: 'simple_message' };
  if (EMOTIONAL_ONLY.test(text) && !/\b(harus|pilih|keputusan|lanjut|rencana)\b/i.test(text)) {
    return { needed: false, reason: 'emotional_support_only' };
  }
  if (/^\//.test(text)) return { needed: false, reason: 'command' };
  const topics = routerPolicy.topics || context.topics || [];
  const selected = routerPolicy.selectedAgents || [];
  const complexByAgents = selected.filter(agent => agent !== 'orchestrator').length >= 2;
  const complexByTopic = topics.some(topic => ['coding', 'debugging', 'planning', 'roadmap', 'security', 'ops', 'deploy', 'backup', 'restore', 'executor'].includes(topic));
  const explicit = COMPLEX_TRIGGER.test(text);
  const councilWantsBreakdown = Boolean(councilResult?.handled && /task|subtask|breakdown|pecah|delegasi/i.test(councilResult.finalAnswer || councilResult.finalSummary || ''));
  if (explicit || councilWantsBreakdown || (complexByAgents && complexByTopic)) {
    return {
      needed: true,
      reason: explicit ? 'explicit_delegation_request' : (councilWantsBreakdown ? 'council_recommends_breakdown' : 'multi_domain_complex_request')
    };
  }
  return { needed: false, reason: 'single_agent_sufficient' };
}

function buildDelegationPlan(message = '', context = {}, selectedAgents = [], services = {}) {
  const text = String(message || '');
  const riskLevel = utils.inferRiskFromText(text);
  const tasks = [];
  const add = (type, agentId, title, description, expectedOutput, priority = 'medium') => {
    tasks.push(assignment.assignTaskToAgent(utils.buildAgentTask({
      workspaceId: context.workspaceId || 'default',
      userId: context.userId || '',
      chatId: context.chatId || '',
      delegationId: context.delegationId || '',
      source: context.source || 'natural_chat',
      title,
      description,
      input: text,
      expectedOutput,
      type,
      priority,
      riskLevel,
      visibility: selectedAgents.includes(agentId) ? 'summary_only' : 'internal',
      assignedAgentId: agentId
    }), null, { topics: context.topics || [] }, services));
  };

  if (/\b(error|deploy|render|webhook|crash|health)\b/i.test(text)) {
    add('ops_check', 'ops', 'Ops deploy diagnosis', 'Cek kemungkinan masalah deploy/runtime, env, webhook, health, storage.', 'Checklist diagnosis deploy dan rekomendasi urutan cek.', 'high');
    add('coding_review', 'coder', 'Coder regression review', 'Cari kemungkinan bug/config/code path yang menyebabkan error deploy.', 'Dugaan penyebab teknis dan test minimal.', 'high');
    add('risk_review', 'critic', 'Critic assumptions review', 'Cari asumsi yang belum tervalidasi dan risiko rollback.', 'Risiko utama dan mitigasi.');
  } else if (/\b(restore|import|backup|delete|hapus|token|secret|permission)\b/i.test(text)) {
    add('risk_review', 'security', 'Security approval review', 'Nilai risiko data/permission/secret dan approval boundary.', 'Risk review dan approval requirement.', 'high');
    add('ops_check', 'ops', 'Ops recovery check', 'Cek integrity/checksum/storage/recovery path sebelum action.', 'Recovery checklist tanpa menjalankan restore.', 'high');
    add('decision_support', 'executor', 'Executor proposal guidance', 'Ubah action berisiko menjadi rekomendasi proposal executor.', 'Proposal recommendation, bukan eksekusi.');
  } else if (/\b(code|coding|implement|module|file|refactor|api|dashboard|phase)\b/i.test(text)) {
    add('planning', 'planner', 'Planner scope and sequence', 'Tentukan scope, urutan, dan batas Phase/request.', 'Scope, sequence, dan milestone kecil.', 'high');
    add('coding_review', 'coder', 'Coder implementation map', 'Petakan modul/file dan test yang perlu disentuh.', 'File/module plan dan regression tests.', 'high');
    add('risk_review', 'critic', 'Critic scope and regression risk', 'Cari risiko scope creep dan fitur lama yang bisa rusak.', 'Risk note dan mitigasi.');
    if (utils.requiresApprovalForText(text, riskLevel) || /\b(external|token|api|integrasi)\b/i.test(text)) {
      add('risk_review', 'security', 'Security boundary review', 'Review token/API/external integration safety.', 'Security guard dan approval boundary.');
    }
  } else {
    add('planning', 'planner', 'Planner breakdown', 'Pecah request menjadi langkah kecil.', 'Task breakdown dan prioritas.');
    add('risk_review', 'critic', 'Critic review', 'Cari risiko, asumsi, dan scope creep.', 'Risk note dan mitigasi.');
    add('summary', 'orchestrator', 'Orchestrator synthesis', 'Gabungkan hasil agent menjadi jawaban final.', 'Final answer ringkas.');
  }

  const uniqueTasks = tasks
    .filter((task, index, arr) => arr.findIndex(item => item.type === task.type && item.assignedAgentId === task.assignedAgentId) === index)
    .slice(0, 5);
  return uniqueTasks.length >= 2 ? uniqueTasks : uniqueTasks.concat(assignment.assignTaskToAgent(utils.buildAgentTask({
    workspaceId: context.workspaceId || 'default',
    userId: context.userId || '',
    chatId: context.chatId || '',
    source: context.source || 'natural_chat',
    title: 'Orchestrator final synthesis',
    description: 'Gabungkan hasil menjadi jawaban final.',
    input: text,
    type: 'summary',
    assignedAgentId: 'orchestrator'
  }), null, context, services)).slice(0, 5);
}

async function createDelegationSession(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) {
    input = { ...input, originalMessage: utils.sanitizeDelegationText(input.originalMessage || input.message || '', { max: 800 }) };
  }
  return store.createDelegation(input, services);
}

async function planDelegation(sessionId, services = {}) {
  const session = await store.getDelegation(sessionId, services);
  if (!session) throw new Error('DELEGATION_NOT_FOUND');
  const route = agentRouter.routeMessage(session.originalMessageSummary || session.goal || '', {
    userId: session.userId,
    chatId: session.chatId,
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 5 }
  }, services);
  const tasks = buildDelegationPlan(session.originalMessageSummary || session.goal, {
    workspaceId: session.workspaceId,
    userId: session.userId,
    chatId: session.chatId,
    source: session.source,
    delegationId: session.id,
    topics: route.topics || []
  }, route.selectedAgents || [], services).map(task => ({ ...task, delegationId: session.id }));
  const created = [];
  for (const task of tasks) {
    created.push(await taskQueue.enqueueAgentTask(task, services));
    await utils.auditDelegation('agents/agent_task_assigned', {
      taskId: created[created.length - 1].id,
      delegationId: session.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
      agentId: created[created.length - 1].assignedAgentId,
      riskLevel: created[created.length - 1].riskLevel,
      status: 'queued'
    }, services);
  }
  const next = await store.updateDelegation(session.id, {
    status: 'planning',
    selectedAgents: utils.unique(created.map(task => task.assignedAgentId)),
    tasks: created.map(task => task.id),
    approvalRequired: session.approvalRequired || created.some(task => task.requiresApproval)
  }, services);
  await utils.auditDelegation('agents/delegation_plan_created', {
    delegationId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    taskCount: created.length,
    selectedAgents: next.selectedAgents
  }, services);
  return { session: next, tasks: created };
}

async function runDelegation(sessionId, services = {}) {
  let session = await store.getDelegation(sessionId, services);
  if (!session) throw new Error('DELEGATION_NOT_FOUND');
  if (!session.tasks?.length) {
    await planDelegation(sessionId, services);
    session = await store.getDelegation(sessionId, services);
  }
  session = await store.updateDelegation(sessionId, { status: 'running' }, services);
  const completed = [];
  for (const taskId of session.tasks || []) {
    const task = await taskRunner.runAgentTask(taskId, services);
    completed.push(task);
    const handoff = handoffManager.shouldHandoffTask(task, task.result || {}, services);
    if (handoff.needed) {
      await handoffManager.createHandoff(task.id, task.assignedAgentId, handoff.toAgentId, handoff.reason, services);
    }
  }
  const aggregate = await aggregator.aggregateTaskResults(sessionId, services);
  return completeDelegation(sessionId, aggregate, services);
}

async function completeDelegation(sessionId, result, services = {}) {
  const session = await store.updateDelegation(sessionId, {
    status: 'completed',
    finalSummary: result.finalAnswer || result.finalSummary || '',
    actionRecommendations: result.actionRecommendations || [],
    approvalRequired: Boolean(result.session?.approvalRequired || result.approvalRequired),
    completedAt: utils.nowIso()
  }, services);
  await delegationMemory.saveDelegationSummaryIfUseful(sessionId, services);
  await utils.auditDelegation('agents/delegation_completed', {
    delegationId: sessionId,
    workspaceId: session.workspaceId,
    userId: session.userId,
    status: 'completed',
    riskLevel: session.riskLevel,
    approvalRequired: session.approvalRequired
  }, services);
  return { ok: true, ...result, session, finalAnswer: result.finalAnswer || session.finalSummary };
}

async function cancelDelegation(sessionId, actor = {}, services = {}) {
  const session = await store.updateDelegation(sessionId, { status: 'cancelled', completedAt: utils.nowIso() }, services);
  await utils.auditDelegation('agents/delegation_cancelled', {
    delegationId: sessionId,
    workspaceId: session.workspaceId,
    userId: session.userId,
    actorId: actor.actorId || actor.userId || '',
    status: 'cancelled'
  }, services);
  return session;
}

async function getDelegationSession(sessionId, services = {}) {
  return store.getDelegation(sessionId, services);
}

async function listDelegationSessions(filters = {}, services = {}) {
  return store.listDelegations(filters, services);
}

module.exports = {
  buildDelegationPlan,
  cancelDelegation,
  completeDelegation,
  createDelegationSession,
  getDelegationSession,
  listDelegationSessions,
  planDelegation,
  runDelegation,
  shouldTriggerDelegation
};
