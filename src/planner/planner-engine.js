'use strict';

const auditLog = require('../dashboard/audit-log');
const guards = require('./planner-guards');
const dependencyDetector = require('./dependency-detector');
const milestonePlanner = require('./milestone-planner');
const priorityScorer = require('./priority-scorer');
const store = require('./planner-store');
const taskOrchestrator = require('./task-orchestrator');
const utils = require('./planner-utils');

async function audit(action, plan, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || 'planner',
      actorId: extra.actorId || plan.userId,
      action,
      targetType: 'plan',
      targetId: plan.id,
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      actorRole: extra.actorRole || '',
      permission: extra.permission || 'write',
      decision: 'allowed',
      status: 'ok',
      beforeSummary: extra.beforeSummary || '',
      afterSummary: utils.summarizePlan(plan)
    }, services);
  } catch (_) {}
}

async function createPlan(input = {}, services = {}) {
  const userId = String(input.userId || input.actorId || '').trim();
  const workspaceId = await utils.resolveWorkspaceId(userId, input.workspaceId, services);
  const access = await guards.enforcePlannerPermission({
    actorId: input.actorId || userId,
    userId,
    workspaceId,
    permission: 'write',
    action: 'plan/create'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const validation = guards.validatePlanInput(input);
  if (!validation.ok) return { ok: false, reason: validation.error, status: 400 };

  const now = utils.nowIso();
  const plan = {
    id: input.id || utils.createId('plan'),
    workspaceId,
    userId,
    title: validation.value.title,
    description: validation.value.description,
    horizon: validation.value.horizon,
    status: validation.value.status,
    linkedGoalIds: validation.value.linkedGoalIds,
    linkedWorkflowIds: validation.value.linkedWorkflowIds,
    taskIds: [],
    assumptions: validation.value.assumptions,
    risks: validation.value.risks,
    milestones: [],
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };

  await store.upsertPlannerItem(store.PLANNER_SESSIONS_KEY, plan, services);

  const createdTasks = [];
  for (const taskInput of Array.isArray(input.tasks) ? input.tasks.slice(0, 30) : []) {
    const taskResult = await taskOrchestrator.createTask({
      ...taskInput,
      actorId: access.actorId,
      userId,
      workspaceId,
      planId: plan.id
    }, services);
    if (taskResult.ok) createdTasks.push(taskResult.task);
  }

  const milestones = milestonePlanner.generateMilestones(plan, createdTasks);
  const finalPlan = await store.updatePlannerItem(store.PLANNER_SESSIONS_KEY, plan.id, {
    taskIds: createdTasks.map(task => task.id),
    milestones
  }, services);
  await audit('planner/plan_created', finalPlan, services, access);
  return { ok: true, plan: finalPlan, tasks: createdTasks };
}

async function getPlan(planId, services = {}) {
  const plan = await store.getPlannerItem(store.PLANNER_SESSIONS_KEY, planId, services);
  if (!plan || plan.status === 'archived') return null;
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || plan.userId,
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    permission: 'read',
    action: 'plan/read'
  }, services);
  return access.ok ? plan : null;
}

async function listPlans(options = {}, services = {}) {
  const userId = String(options.userId || options.actorId || '').trim();
  const workspaceId = await utils.resolveWorkspaceId(userId, options.workspaceId, services);
  const access = await guards.enforcePlannerPermission({
    actorId: options.actorId || userId,
    userId,
    workspaceId,
    permission: 'read',
    action: 'plan/list'
  }, services);
  if (!access.ok) return [];
  return store.listPlannerItems(store.PLANNER_SESSIONS_KEY, {
    userId: access.userId,
    workspaceId: access.workspaceId,
    status: options.status || '',
    includeArchived: Boolean(options.includeArchived),
    limit: options.limit || 100
  }, services);
}

async function updatePlan(planId, patch = {}, services = {}) {
  const existing = await store.getPlannerItem(store.PLANNER_SESSIONS_KEY, planId, services);
  if (!existing || existing.status === 'archived') return { ok: false, reason: 'PLAN_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: patch.actorId || services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    permission: 'write',
    action: 'plan/update'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const validation = guards.validatePlanInput({ ...existing, ...patch });
  if (!validation.ok) return { ok: false, reason: validation.error, status: 400 };
  const updated = await store.updatePlannerItem(store.PLANNER_SESSIONS_KEY, planId, {
    ...validation.value,
    status: patch.status ? utils.normalizePlanStatus(patch.status) : existing.status,
    taskIds: Array.isArray(patch.taskIds) ? utils.uniqueList(patch.taskIds, 300) : existing.taskIds,
    milestones: Array.isArray(patch.milestones) ? patch.milestones.slice(0, 30) : existing.milestones
  }, services);
  await audit('planner/plan_updated', updated, services, { ...access, beforeSummary: utils.summarizePlan(existing) });
  return { ok: true, plan: updated };
}

async function archivePlan(planId, services = {}) {
  const existing = await store.getPlannerItem(store.PLANNER_SESSIONS_KEY, planId, services);
  if (!existing) return { ok: false, reason: 'PLAN_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    permission: 'write',
    action: 'plan/archive'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const updated = await store.updatePlannerItem(store.PLANNER_SESSIONS_KEY, planId, {
    status: 'archived',
    archivedAt: utils.nowIso()
  }, services);
  await audit('planner/plan_archived', updated, services, { ...access, beforeSummary: utils.summarizePlan(existing) });
  return { ok: true, plan: updated };
}

async function getGoalById(userId, goalId, services = {}) {
  const repos = services.storageManager?.getRepositories?.();
  if (repos?.goals?.getGoalById) {
    const goal = await repos.goals.getGoalById(userId, goalId);
    if (goal) return goal;
  }
  const goalManager = services.aiOS?.goalManager;
  if (goalManager?.listGoals) {
    const goals = await goalManager.listGoals(userId, {}, services);
    return (goals || []).find(goal => String(goal.id) === String(goalId)) || null;
  }
  return null;
}

function taskTemplatesFromText(text = '', goal = null) {
  const candidates = utils.extractTaskCandidates(text);
  const base = candidates.length > 1 ? candidates : [
    'Tentukan definisi selesai dan batas scope',
    'Pecah pekerjaan inti menjadi langkah kecil',
    'Kerjakan item prioritas tertinggi',
    'Validasi hasil dengan test/manual checklist',
    'Dokumentasikan keputusan dan risiko'
  ];
  return base.slice(0, 12).map((title, index) => ({
    title,
    description: index === 0 && goal?.description ? goal.description : '',
    impact: index < 2 ? 'high' : 'medium',
    urgency: index < 2 ? 'high' : 'medium',
    effort: index === 0 ? 'small' : 'medium',
    linkedGoalId: goal?.id || ''
  }));
}

async function generatePlanFromGoal(goalId, options = {}, services = {}) {
  const userId = String(options.userId || options.actorId || '').trim();
  const goal = await getGoalById(userId, goalId, services);
  const title = goal?.title ? `Plan: ${goal.title}` : `Plan untuk goal ${goalId}`;
  const description = goal?.description || 'Plan dibuat dari goal yang dipilih.';
  const tasks = taskTemplatesFromText(`${title}\n${description}`, goal);
  const result = await createPlan({
    actorId: options.actorId || userId,
    userId,
    workspaceId: options.workspaceId || goal?.workspaceId || goal?.metadata?.workspaceId,
    title,
    description,
    horizon: options.horizon || 'weekly',
    status: 'active',
    linkedGoalIds: [goalId],
    tasks
  }, services);
  if (result.ok) await audit('planner/plan_generated_from_goal', result.plan, services, { actorId: options.actorId || userId });
  return result;
}

async function generatePlanFromText(text, options = {}, services = {}) {
  const cleanText = utils.compactText(text, 2000);
  if (!cleanText) return { ok: false, reason: 'TEXT_REQUIRED', status: 400 };
  const secret = guards.preventSecretLeakInPlanner({ text: cleanText });
  if (!secret.ok) return { ok: false, reason: secret.error, status: 400 };
  const title = options.title || cleanText.split(/[.\n]/)[0].slice(0, 120) || 'Generated Plan';
  const tasks = taskTemplatesFromText(cleanText);
  const result = await createPlan({
    actorId: options.actorId || options.userId,
    userId: options.userId || options.actorId,
    workspaceId: options.workspaceId,
    title,
    description: cleanText,
    horizon: options.horizon || 'weekly',
    status: 'active',
    tasks,
    assumptions: options.assumptions || [],
    risks: options.risks || []
  }, services);
  if (result.ok) await audit('planner/plan_generated_from_text', result.plan, services, { actorId: options.actorId || options.userId });
  return result;
}

async function suggestNextActions(workspaceId, userId, services = {}) {
  const resolvedWorkspaceId = await utils.resolveWorkspaceId(userId, workspaceId, services);
  const tasks = await taskOrchestrator.listTasks({
    actorId: services.actorId || userId,
    userId,
    workspaceId: resolvedWorkspaceId,
    status: '',
    limit: 100
  }, services);
  const open = tasks.filter(task => ['todo', 'doing', 'blocked'].includes(task.status));
  const ordered = dependencyDetector.suggestDependencyOrder(priorityScorer.rankTasks(open, {}));
  return {
    ok: true,
    workspaceId: resolvedWorkspaceId,
    actions: ordered.slice(0, 5),
    blocked: dependencyDetector.findBlockedTasks(open).slice(0, 5)
  };
}

async function summarizePlan(planId, services = {}) {
  const plan = await getPlan(planId, services);
  if (!plan) return { ok: false, reason: 'PLAN_NOT_FOUND', status: 404 };
  const tasks = await taskOrchestrator.listTasks({
    actorId: services.actorId || plan.userId,
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    planId,
    includeArchived: false,
    limit: 100
  }, services);
  const done = tasks.filter(task => task.status === 'done').length;
  const blocked = tasks.filter(task => task.status === 'blocked').length;
  const milestones = await milestonePlanner.updateMilestoneProgress(planId, services);
  const next = priorityScorer.rankTasks(tasks.filter(task => ['todo', 'doing', 'blocked'].includes(task.status)), {}).slice(0, 3);
  return {
    ok: true,
    plan,
    tasks,
    summaryText: [
      `${plan.title} (${plan.status}, ${plan.horizon})`,
      `Workspace: ${plan.workspaceId}`,
      `Progress: ${done}/${tasks.length} task selesai, blocked ${blocked}`,
      '',
      'Milestone:',
      ...(milestones.milestones?.length ? milestones.milestones.map((item, index) => `${index + 1}. ${item.title} - ${item.status} (${item.progress}%)`) : ['- belum ada']),
      '',
      'Next action:',
      ...(next.length ? next.map((task, index) => `${index + 1}. ${task.title} [${task.priority}, ${task.priorityScore}]`) : ['- belum ada task aktif'])
    ].join('\n')
  };
}

function detectPlannerNaturalNeed(text = '', adaptiveResult = {}) {
  return utils.detectPlannerNaturalNeed(text, adaptiveResult);
}

function formatNextActions(actions = [], blocked = []) {
  const lines = [
    'Prioritas berikutnya:',
    ...(actions.length ? actions.map((task, index) => `${index + 1}. ${task.title} [${task.priority}, score ${task.priorityScore}]`) : ['- Belum ada task planner aktif. Buat dengan /planadd atau /taskadd.'])
  ];
  if (blocked.length) {
    lines.push('', 'Blocked:', ...blocked.map(task => `- ${task.title}${task.blockedReason ? `: ${task.blockedReason}` : ''}`));
  }
  return lines.join('\n');
}

async function answerWithPlannerContext(userId, chatId, text, msg, services = {}) {
  try {
    const detection = detectPlannerNaturalNeed(text, services.adaptiveDecision || {});
    if (!detection.shouldUse) return { handled: false, reason: detection.reason };
    const workspaceId = await utils.resolveWorkspaceId(userId, services.workspaceId, services);
    const lower = String(text || '').toLowerCase();
    const send = services.sendChunkedMessage || services.safeSendMessage;
    if (typeof send !== 'function') return { handled: false, reason: 'sender_missing' };
    let answer = '';

    if (/buat.*roadmap|buat.*rencana|pecah.*goal|pecah.*tujuan|jadi task/i.test(lower)) {
      const result = await generatePlanFromText(text, { userId, actorId: userId, workspaceId, title: 'Roadmap dari chat' }, services);
      answer = result.ok
        ? `Saya buatkan plan awal:\n${result.plan.id} - ${result.plan.title}\n\nTask awal:\n${result.tasks.map((task, index) => `${index + 1}. ${task.title}`).join('\n')}`
        : `Belum bisa membuat plan: ${result.reason || 'unknown'}`;
    } else {
      const next = await suggestNextActions(workspaceId, userId, { ...services, actorId: userId });
      answer = formatNextActions(next.actions, next.blocked);
    }

    await send(chatId, answer, { reply_to_message_id: msg?.message_id });
    return { handled: true, answer, type: 'planner', confidence: detection.confidence };
  } catch (err) {
    services.log?.warn?.('Natural planner integration skipped:', err.message);
    return { handled: false, reason: 'planner_error' };
  }
}

module.exports = {
  archivePlan,
  answerWithPlannerContext,
  createPlan,
  detectPlannerNaturalNeed,
  generatePlanFromGoal,
  generatePlanFromText,
  getPlan,
  listPlans,
  suggestNextActions,
  summarizePlan,
  updatePlan
};
