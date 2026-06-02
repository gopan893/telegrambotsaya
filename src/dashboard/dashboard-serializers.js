'use strict';

const guards = require('./dashboard-guards');
const { isSet } = require('./dashboard-utils');

function truncateText(text = '', max = 500) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return guards.preventSecretLeak(clean);
  return guards.preventSecretLeak(`${clean.slice(0, Math.max(0, max - 3)).trim()}...`);
}

function pickBase(record = {}) {
  return guards.preventSecretLeak({
    id: record.id,
    type: record.type,
    status: record.status,
    workspaceId: record.workspaceId || record.workspace_id || record.metadata?.workspaceId || record.metadata?.workspace_id || null,
    createdAt: record.createdAt || record.created_at,
    updatedAt: record.updatedAt || record.updated_at
  });
}

function sanitizeMemory(memory = {}) {
  return {
    ...pickBase(memory),
    content: truncateText(memory.content || memory.text || memory.summary || '', 500),
    summary: truncateText(memory.summary || '', 240),
    tags: Array.isArray(memory.tags) ? memory.tags.slice(0, 12).map(tag => truncateText(tag, 60)) : [],
    source: truncateText(memory.source || '', 80),
    confidence: Number(memory.confidence ?? 0.5),
    importance: Number(memory.importance ?? 0.5)
  };
}

function sanitizeGoal(goal = {}) {
  return {
    ...pickBase(goal),
    title: truncateText(goal.title || '', 160),
    description: truncateText(goal.description || '', 500),
    priority: goal.priority || 'medium',
    progress: Number(goal.progress || 0),
    targetDate: goal.targetDate || goal.target_date || null,
    completedAt: goal.completedAt || goal.completed_at || null
  };
}

function sanitizeWorkflow(workflow = {}) {
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  return {
    ...pickBase(workflow),
    title: truncateText(workflow.title || '', 160),
    description: truncateText(workflow.description || workflow.contextSummary || workflow.context_summary || '', 500),
    goalId: workflow.goalId || workflow.goal_id || null,
    linkedPlanId: workflow.linkedPlanId || workflow.linked_plan_id || workflow.metadata?.planId || workflow.metadata?.linkedPlanId || null,
    linkedTaskIds: Array.isArray(workflow.linkedTaskIds || workflow.linked_task_ids || workflow.metadata?.taskIds)
      ? (workflow.linkedTaskIds || workflow.linked_task_ids || workflow.metadata?.taskIds).slice(0, 30).map(id => truncateText(id, 120))
      : [],
    steps: steps.slice(0, 30).map(step => ({
      id: step.id,
      stepNumber: step.stepNumber || step.step_number,
      workspaceId: step.workspaceId || step.workspace_id || step.metadata?.workspaceId || null,
      title: truncateText(step.title || step.text || '', 180),
      status: step.status || (step.done ? 'done' : 'pending'),
      result: truncateText(step.result || '', 260),
      completedAt: step.completedAt || step.completed_at || null
    }))
  };
}

function sanitizeMilestone(milestone = {}) {
  return guards.preventSecretLeak({
    id: milestone.id,
    title: truncateText(milestone.title || '', 160),
    targetDate: milestone.targetDate || milestone.target_date || null,
    taskIds: Array.isArray(milestone.taskIds || milestone.task_ids) ? (milestone.taskIds || milestone.task_ids).slice(0, 50).map(id => truncateText(id, 120)) : [],
    status: milestone.status || 'todo',
    progress: Number(milestone.progress || 0)
  });
}

function sanitizePlan(plan = {}) {
  return guards.preventSecretLeak({
    ...pickBase(plan),
    title: truncateText(plan.title || '', 180),
    description: truncateText(plan.description || '', 700),
    horizon: plan.horizon || 'weekly',
    status: plan.status || 'draft',
    linkedGoalIds: Array.isArray(plan.linkedGoalIds || plan.linked_goal_ids) ? (plan.linkedGoalIds || plan.linked_goal_ids).slice(0, 30).map(id => truncateText(id, 120)) : [],
    linkedWorkflowIds: Array.isArray(plan.linkedWorkflowIds || plan.linked_workflow_ids) ? (plan.linkedWorkflowIds || plan.linked_workflow_ids).slice(0, 30).map(id => truncateText(id, 120)) : [],
    taskIds: Array.isArray(plan.taskIds || plan.task_ids) ? (plan.taskIds || plan.task_ids).slice(0, 100).map(id => truncateText(id, 120)) : [],
    assumptions: Array.isArray(plan.assumptions) ? plan.assumptions.slice(0, 20).map(item => truncateText(item, 160)) : [],
    risks: Array.isArray(plan.risks) ? plan.risks.slice(0, 20).map(item => truncateText(item, 180)) : [],
    milestones: Array.isArray(plan.milestones) ? plan.milestones.slice(0, 20).map(sanitizeMilestone) : [],
    archivedAt: plan.archivedAt || plan.archived_at || null
  });
}

function sanitizeTask(task = {}) {
  return guards.preventSecretLeak({
    ...pickBase(task),
    planId: truncateText(task.planId || task.plan_id || '', 120),
    title: truncateText(task.title || '', 180),
    description: truncateText(task.description || '', 700),
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    priorityScore: Number(task.priorityScore || task.priority_score || 0),
    priorityExplanation: truncateText(task.priorityExplanation || task.priority_explanation || '', 260),
    effort: task.effort || 'medium',
    impact: task.impact || 'medium',
    urgency: task.urgency || 'medium',
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.slice(0, 30).map(id => truncateText(id, 120)) : [],
    linkedGoalId: truncateText(task.linkedGoalId || task.linked_goal_id || '', 120),
    linkedWorkflowId: truncateText(task.linkedWorkflowId || task.linked_workflow_id || '', 120),
    dueDate: task.dueDate || task.due_date || null,
    blockedReason: truncateText(task.blockedReason || task.blocked_reason || '', 260),
    completedAt: task.completedAt || task.completed_at || null,
    archivedAt: task.archivedAt || task.archived_at || null
  });
}

function sanitizeExecutionAction(action = {}) {
  return guards.preventSecretLeak({
    id: action.id,
    type: truncateText(action.type || '', 120),
    targetType: truncateText(action.targetType || '', 80),
    targetId: truncateText(action.targetId || '', 120),
    workspaceId: truncateText(action.workspaceId || '', 120),
    userId: truncateText(action.userId || '', 80),
    description: truncateText(action.description || '', 360),
    payload: guards.preventSecretLeak(action.payload || {}),
    riskLevel: action.riskLevel || 'medium',
    requiresApproval: action.requiresApproval !== false,
    status: action.status || 'pending_approval'
  });
}

function sanitizeExecutionProposal(proposal = {}) {
  return guards.preventSecretLeak({
    ...pickBase(proposal),
    sourceType: proposal.sourceType || 'manual',
    sourceId: truncateText(proposal.sourceId || '', 120),
    title: truncateText(proposal.title || '', 180),
    description: truncateText(proposal.description || '', 700),
    proposedActions: Array.isArray(proposal.proposedActions) ? proposal.proposedActions.slice(0, 30).map(sanitizeExecutionAction) : [],
    riskLevel: proposal.riskLevel || 'medium',
    requiresApproval: proposal.requiresApproval !== false,
    approvedBy: truncateText(proposal.approvedBy || '', 80),
    approvedAt: proposal.approvedAt || null,
    rejectedBy: truncateText(proposal.rejectedBy || '', 80),
    rejectedAt: proposal.rejectedAt || null,
    expiresAt: proposal.expiresAt || null,
    resultSummary: truncateText(proposal.resultSummary || '', 500),
    errorSummary: truncateText(proposal.errorSummary || '', 500)
  });
}

function sanitizeExecutionRun(run = {}) {
  return guards.preventSecretLeak({
    id: run.id,
    proposalId: truncateText(run.proposalId || '', 120),
    workspaceId: truncateText(run.workspaceId || '', 120),
    userId: truncateText(run.userId || '', 80),
    status: run.status || 'unknown',
    actionResults: Array.isArray(run.actionResults) ? run.actionResults.slice(0, 30).map(item => guards.preventSecretLeak({
      ok: Boolean(item.ok),
      actionId: truncateText(item.actionId || '', 120),
      actionType: truncateText(item.actionType || '', 120),
      result: item.result || null,
      error: truncateText(item.error || '', 240),
      rollback: truncateText(item.rollback || '', 240)
    })) : [],
    resultSummary: truncateText(run.resultSummary || '', 500),
    errorSummary: truncateText(run.errorSummary || '', 500),
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null,
    createdAt: run.createdAt || null,
    updatedAt: run.updatedAt || null
  });
}

function sanitizeToolMetadata(tool = {}) {
  return guards.preventSecretLeak({
    id: truncateText(tool.id || '', 120),
    name: truncateText(tool.name || '', 140),
    description: truncateText(tool.description || '', 700),
    category: tool.category || 'utility',
    version: truncateText(tool.version || '', 40),
    enabled: tool.enabled !== false,
    unavailableReason: truncateText(tool.unavailableReason || '', 180),
    source: tool.source || 'builtin',
    actionType: truncateText(tool.actionType || tool.id || '', 120),
    riskLevel: tool.riskLevel || 'low',
    permissionsRequired: Array.isArray(tool.permissionsRequired) ? tool.permissionsRequired.slice(0, 10).map(item => truncateText(item, 40)) : [],
    requiresApproval: Boolean(tool.requiresApproval),
    workspaceAware: tool.workspaceAware !== false,
    inputSchema: guards.preventSecretLeak(tool.inputSchema || {}),
    outputSchema: guards.preventSecretLeak(tool.outputSchema || {}),
    rateLimit: guards.preventSecretLeak(tool.rateLimit || {}),
    timeoutMs: Number(tool.timeoutMs || 0),
    createdAt: tool.createdAt || null,
    updatedAt: tool.updatedAt || null
  });
}

function sanitizeToolRun(run = {}) {
  return guards.preventSecretLeak({
    id: truncateText(run.id || '', 120),
    toolId: truncateText(run.toolId || '', 120),
    actionType: truncateText(run.actionType || '', 120),
    userId: truncateText(run.userId || '', 80),
    workspaceId: truncateText(run.workspaceId || '', 120),
    status: run.status || 'unknown',
    success: Boolean(run.success),
    latencyMs: Number(run.latencyMs || 0),
    riskLevel: run.riskLevel || 'low',
    requiresApproval: Boolean(run.requiresApproval),
    resultSummary: truncateText(run.resultSummary || '', 500),
    error: truncateText(run.error || '', 260),
    createdAt: run.createdAt || null
  });
}

function sanitizeToolAudit(entry = {}) {
  return guards.preventSecretLeak({
    id: truncateText(entry.id || '', 120),
    action: truncateText(entry.action || '', 120),
    toolId: truncateText(entry.toolId || '', 120),
    actionType: truncateText(entry.actionType || '', 120),
    riskLevel: entry.riskLevel || 'low',
    userId: truncateText(entry.userId || '', 80),
    workspaceId: truncateText(entry.workspaceId || '', 120),
    actorRole: truncateText(entry.actorRole || '', 40),
    permission: truncateText(entry.permission || '', 40),
    decision: entry.decision || 'allowed',
    status: entry.status || 'ok',
    summary: guards.preventSecretLeak(entry.summary || {}),
    reason: truncateText(entry.reason || '', 240),
    createdAt: entry.createdAt || null
  });
}

function sanitizeBackupManifest(manifest = {}) {
  return guards.preventSecretLeak({
    id: truncateText(manifest.id || '', 120),
    type: manifest.type || 'workspace',
    workspaceId: truncateText(manifest.workspaceId || '', 120),
    userId: truncateText(manifest.userId || '', 80),
    createdBy: truncateText(manifest.createdBy || '', 80),
    status: manifest.status || 'created',
    version: truncateText(manifest.version || '', 40),
    itemCounts: manifest.itemCounts || {},
    checksum: truncateText(manifest.checksum || '', 96),
    sanitized: manifest.sanitized === true,
    includes: Array.isArray(manifest.includes) ? manifest.includes.slice(0, 40).map(item => truncateText(item, 80)) : [],
    excludes: Array.isArray(manifest.excludes) ? manifest.excludes.slice(0, 40).map(item => truncateText(item, 80)) : [],
    createdAt: manifest.createdAt || null,
    restoredAt: manifest.restoredAt || null,
    errorSummary: truncateText(manifest.errorSummary || '', 300)
  });
}

function sanitizeBackupSnapshot(snapshot = {}) {
  return guards.preventSecretLeak({
    id: truncateText(snapshot.id || '', 120),
    manifestId: truncateText(snapshot.manifestId || '', 120),
    checksum: truncateText(snapshot.checksum || '', 96),
    createdAt: snapshot.createdAt || null,
    itemCounts: snapshot.payload?.data ? Object.fromEntries(Object.entries(snapshot.payload.data).map(([key, value]) => [key, Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0)])) : {}
  });
}

function sanitizeRestorePlan(plan = {}) {
  return guards.preventSecretLeak({
    id: truncateText(plan.id || '', 120),
    backupId: truncateText(plan.backupId || '', 120),
    status: plan.status || 'planned',
    mode: truncateText(plan.mode || 'merge_upsert', 80),
    workspaceId: truncateText(plan.workspaceId || '', 120),
    userId: truncateText(plan.userId || '', 80),
    actorRole: truncateText(plan.actorRole || '', 40),
    requiresConfirmation: Boolean(plan.requiresConfirmation),
    confirmationText: plan.confirmationText ? 'RESTORE' : '',
    allowOverwrite: Boolean(plan.allowOverwrite),
    itemCounts: plan.itemCounts || {},
    diff: guards.preventSecretLeak(plan.diff || {}),
    results: Array.isArray(plan.results) ? plan.results.slice(0, 60) : [],
    createdAt: plan.createdAt || null,
    updatedAt: plan.updatedAt || null,
    restoredAt: plan.restoredAt || null,
    errorSummary: truncateText(plan.errorSummary || '', 300)
  });
}

function sanitizeBackupSchedule(schedule = {}) {
  return guards.preventSecretLeak({
    id: truncateText(schedule.id || '', 120),
    workspaceId: truncateText(schedule.workspaceId || '', 120),
    userId: truncateText(schedule.userId || '', 80),
    name: truncateText(schedule.name || '', 160),
    scope: schedule.scope || 'workspace',
    frequency: schedule.frequency || 'manual',
    enabled: schedule.enabled !== false,
    requiresApproval: schedule.requiresApproval !== false,
    nextRunAt: schedule.nextRunAt || null,
    lastRunAt: schedule.lastRunAt || null,
    lastStatus: truncateText(schedule.lastStatus || '', 80),
    due: Boolean(schedule.due),
    createdBy: truncateText(schedule.createdBy || '', 80),
    approvedBy: truncateText(schedule.approvedBy || '', 80),
    approvedAt: schedule.approvedAt || null,
    createdAt: schedule.createdAt || null,
    updatedAt: schedule.updatedAt || null,
    archivedAt: schedule.archivedAt || null
  });
}

function sanitizeBackupScheduleRun(run = {}) {
  return guards.preventSecretLeak({
    id: truncateText(run.id || '', 120),
    scheduleId: truncateText(run.scheduleId || '', 120),
    workspaceId: truncateText(run.workspaceId || '', 120),
    userId: truncateText(run.userId || '', 80),
    scope: run.scope || 'workspace',
    status: run.status || 'pending_approval',
    requiresApproval: run.requiresApproval !== false,
    requestedBy: truncateText(run.requestedBy || '', 80),
    approvedBy: truncateText(run.approvedBy || '', 80),
    approvedAt: run.approvedAt || null,
    backupId: truncateText(run.backupId || '', 120),
    errorSummary: truncateText(run.errorSummary || '', 300),
    createdAt: run.createdAt || null,
    updatedAt: run.updatedAt || null,
    completedAt: run.completedAt || null
  });
}

function sanitizeInsight(insight = {}) {
  return {
    ...pickBase(insight),
    content: truncateText(insight.content || insight.text || '', 500),
    source: truncateText(insight.source || '', 80),
    relatedConcepts: Array.isArray(insight.relatedConcepts || insight.related_concepts)
      ? (insight.relatedConcepts || insight.related_concepts).slice(0, 12).map(item => truncateText(item, 80))
      : [],
    confidence: Number(insight.confidence ?? 0.5),
    importance: Number(insight.importance ?? 0.5)
  };
}

function sanitizeGraphNode(node = {}) {
  return {
    id: node.id,
    label: truncateText(node.label || '', 120),
    type: node.type || 'concept',
    summary: truncateText(node.summary || '', 320),
    aliases: Array.isArray(node.aliases) ? node.aliases.slice(0, 10).map(alias => truncateText(alias, 80)) : [],
    tags: Array.isArray(node.tags) ? node.tags.slice(0, 12).map(tag => truncateText(tag, 80)) : [],
    importance: Number(node.importance ?? 0.5),
    confidence: Number(node.confidence ?? 0.5),
    occurrenceCount: Number(node.occurrenceCount || node.occurrence_count || node.seenCount || 1),
    workspaceId: node.workspaceId || node.workspace_id || node.metadata?.workspaceId || node.metadata?.workspace_id || null,
    source: truncateText(node.source || '', 80),
    createdAt: node.createdAt || node.created_at,
    updatedAt: node.updatedAt || node.updated_at,
    lastSeenAt: node.lastSeenAt || node.last_seen_at
  };
}

function sanitizeGraphEdge(edge = {}) {
  return {
    id: edge.id,
    from: edge.from || edge.fromNodeId || edge.from_node_id,
    to: edge.to || edge.toNodeId || edge.to_node_id,
    relationship: edge.relationship || 'related_to',
    weight: Number(edge.weight ?? 0.5),
    confidence: Number(edge.confidence ?? 0.5),
    evidence: truncateText(edge.evidence || '', 360),
    source: truncateText(edge.source || '', 80),
    occurrenceCount: Number(edge.occurrenceCount || edge.occurrence_count || 1),
    workspaceId: edge.workspaceId || edge.workspace_id || edge.metadata?.workspaceId || edge.metadata?.workspace_id || null,
    createdAt: edge.createdAt || edge.created_at,
    updatedAt: edge.updatedAt || edge.updated_at
  };
}

function sanitizeOpsData(data = {}) {
  return guards.preventSecretLeak({
    health: data.health || data.status || null,
    telemetry: data.telemetry || null,
    incidents: Array.isArray(data.incidents) ? data.incidents.slice(0, 20) : data.incidents || null,
    recentIncidents: Array.isArray(data.recentIncidents) ? data.recentIncidents.slice(0, 20).map(sanitizeIncident) : [],
    reliability: data.reliability ? sanitizeReliability(data.reliability) : null,
    performance: data.performance ? sanitizePerformance(data.performance) : null,
    benchmarkSummary: data.benchmarkSummary || null,
    modules: Array.isArray(data.modules) ? data.modules.slice(0, 40) : []
  });
}

function sanitizeEnvStatus(env = {}) {
  return {
    telegramToken: isSet(env.TELEGRAM_TOKEN),
    databaseUrl: isSet(env.DATABASE_URL),
    redisUrl: isSet(env.REDIS_URL),
    openWeatherApiKey: isSet(env.OPENWEATHER_API_KEY),
    tavilyApiKey: isSet(env.TAVILY_API_KEY),
    groqApiKey: isSet(env.GROQ_API_KEY),
    mistralApiKey: isSet(env.MISTRAL_API_KEY),
    dashboardAdminToken: isSet(env.DASHBOARD_ADMIN_TOKEN),
    telegramTokenOrchestrator: isSet(env.TELEGRAM_TOKEN_ORCHESTRATOR),
    telegramTokenPlanner: isSet(env.TELEGRAM_TOKEN_PLANNER),
    telegramTokenCoder: isSet(env.TELEGRAM_TOKEN_CODER),
    telegramTokenCritic: isSet(env.TELEGRAM_TOKEN_CRITIC),
    telegramTokenResearch: isSet(env.TELEGRAM_TOKEN_RESEARCH),
    telegramTokenOps: isSet(env.TELEGRAM_TOKEN_OPS),
    telegramTokenSecurity: isSet(env.TELEGRAM_TOKEN_SECURITY),
    telegramTokenMemory: isSet(env.TELEGRAM_TOKEN_MEMORY),
    telegramTokenExecutor: isSet(env.TELEGRAM_TOKEN_EXECUTOR),
    telegramTokenReflection: isSet(env.TELEGRAM_TOKEN_REFLECTION)
  };
}

function sanitizeBotConfig(bot = {}) {
  return guards.preventSecretLeak({
    id: truncateText(bot.id || '', 80),
    username: truncateText(bot.username || '', 120),
    tokenConfigured: Boolean(bot.tokenConfigured),
    agentId: truncateText(bot.agentId || '', 80),
    enabled: Boolean(bot.enabled),
    webhookPath: truncateText(bot.webhookPath || '', 160),
    webhookSecretConfigured: Boolean(bot.webhookSecretConfigured),
    role: truncateText(bot.role || '', 80),
    displayName: truncateText(bot.displayName || bot.role || bot.id || '', 120),
    createdFrom: bot.createdFrom || 'env',
    status: bot.status || 'unknown'
  });
}

function sanitizeAgentSummary(agent = {}) {
  return guards.preventSecretLeak({
    id: truncateText(agent.id || '', 80),
    displayName: truncateText(agent.displayName || '', 140),
    botId: truncateText(agent.botId || '', 80),
    role: truncateText(agent.role || '', 80),
    description: truncateText(agent.description || '', 500),
    personality: truncateText(agent.personality || '', 260),
    specialties: Array.isArray(agent.specialties) ? agent.specialties.slice(0, 24).map(item => truncateText(item, 80)) : [],
    tools: Array.isArray(agent.tools) ? agent.tools.slice(0, 24).map(item => truncateText(item, 80)) : [],
    canSpeakDirectly: Boolean(agent.canSpeakDirectly),
    canAutoRespond: Boolean(agent.canAutoRespond),
    canProposeExecution: Boolean(agent.canProposeExecution),
    canExecuteWithoutApproval: false,
    defaultSilent: Boolean(agent.defaultSilent),
    priority: Number(agent.priority || 0),
    maxAutoReplies: Number(agent.maxAutoReplies || 1),
    riskSensitivity: truncateText(agent.riskSensitivity || 'medium', 40),
    responseStyle: guards.preventSecretLeak(agent.responseStyle || {}),
    memoryPolicy: guards.preventSecretLeak(agent.memoryPolicy || {}),
    knowledgeScope: Array.isArray(agent.knowledgeScope) ? agent.knowledgeScope.slice(0, 24).map(item => truncateText(item, 80)) : [],
    learningNotesEnabled: agent.learningNotesEnabled !== false,
    agentMemoryEnabled: agent.agentMemoryEnabled !== false,
    sharedMemoryEnabled: agent.sharedMemoryEnabled !== false,
    updatedAt: agent.updatedAt || null,
    enabled: agent.enabled !== false
  });
}

function sanitizeAgentProfile(profile = {}) {
  return guards.preventSecretLeak({
    agentId: truncateText(profile.agentId || profile.id || '', 80),
    workspaceId: truncateText(profile.workspaceId || '', 120),
    displayName: truncateText(profile.displayName || '', 140),
    role: truncateText(profile.role || '', 80),
    personality: truncateText(profile.personality || '', 500),
    responseStyle: guards.preventSecretLeak(profile.responseStyle || {}),
    preferences: guards.preventSecretLeak(profile.preferences || {}),
    memoryPolicy: guards.preventSecretLeak(profile.memoryPolicy || {}),
    knowledgeScope: Array.isArray(profile.knowledgeScope) ? profile.knowledgeScope.slice(0, 30).map(item => truncateText(item, 100)) : [],
    safetyRules: Array.isArray(profile.safetyRules) ? profile.safetyRules.slice(0, 20).map(item => truncateText(item, 180)) : [],
    toneRules: Array.isArray(profile.toneRules) ? profile.toneRules.slice(0, 20).map(item => truncateText(item, 180)) : [],
    outputFormatRules: Array.isArray(profile.outputFormatRules) ? profile.outputFormatRules.slice(0, 20).map(item => truncateText(item, 180)) : [],
    learningNotesEnabled: profile.learningNotesEnabled !== false,
    agentMemoryEnabled: profile.agentMemoryEnabled !== false,
    sharedMemoryEnabled: profile.sharedMemoryEnabled !== false,
    updatedAt: profile.updatedAt || null
  });
}

function sanitizeAgentMemory(memory = {}) {
  return guards.preventSecretLeak({
    id: truncateText(memory.id || '', 140),
    agentId: truncateText(memory.agentId || '', 80),
    workspaceId: truncateText(memory.workspaceId || '', 120),
    userId: truncateText(memory.userId || '', 80),
    type: truncateText(memory.type || '', 80),
    title: truncateText(memory.title || '', 180),
    content: truncateText(memory.content || '', 700),
    tags: Array.isArray(memory.tags) ? memory.tags.slice(0, 20).map(item => truncateText(item, 60)) : [],
    source: truncateText(memory.source || '', 100),
    confidence: Number(memory.confidence || 0),
    importance: Number(memory.importance || 0),
    relevanceScore: Number(memory.relevanceScore || 0),
    createdBy: truncateText(memory.createdBy || '', 80),
    createdAt: memory.createdAt || null,
    updatedAt: memory.updatedAt || null,
    archivedAt: memory.archivedAt || null,
    lastUsedAt: memory.lastUsedAt || null,
    usageCount: Number(memory.usageCount || 0)
  });
}

function sanitizeAgentPreferences(preferences = {}) {
  return guards.preventSecretLeak({
    agentId: truncateText(preferences.agentId || '', 80),
    workspaceId: truncateText(preferences.workspaceId || '', 120),
    preferences: guards.preventSecretLeak(preferences.preferences || {}),
    responseStyle: guards.preventSecretLeak(preferences.responseStyle || {}),
    memoryPolicy: guards.preventSecretLeak(preferences.memoryPolicy || {}),
    updatedAt: preferences.updatedAt || null
  });
}

function sanitizeAgentLearningNote(note = {}) {
  return sanitizeAgentMemory({ ...note, type: note.type || 'learning_note' });
}

function sanitizeAgentPromptPreview(preview = {}) {
  return guards.preventSecretLeak({
    agentId: truncateText(preview.agentId || '', 80),
    workspaceId: truncateText(preview.workspaceId || '', 120),
    selectedMemoryCount: Number(preview.selectedMemoryCount || 0),
    sharedMemoryCount: Number(preview.sharedMemoryCount || 0),
    memoryExplanation: truncateText(preview.memoryExplanation || '', 500),
    promptPreview: truncateText(preview.promptPreview || '', 1200),
    selectedMemories: Array.isArray(preview.selectedMemories) ? preview.selectedMemories.slice(0, 5).map(sanitizeAgentMemory) : [],
    sharedMemories: Array.isArray(preview.sharedMemories) ? preview.sharedMemories.slice(0, 3).map(sanitizeAgentMemory) : []
  });
}

function sanitizeAgentRoutingResult(route = {}) {
  return guards.preventSecretLeak({
    topics: Array.isArray(route.topics) ? route.topics.slice(0, 20).map(item => truncateText(item, 80)) : [],
    mentionedAgents: Array.isArray(route.mentionedAgents) ? route.mentionedAgents.slice(0, 20).map(item => truncateText(item, 80)) : [],
    commandMode: truncateText(route.commandMode || '', 80),
    language: truncateText(route.language || 'id', 20),
    intentSignals: route.intentSignals || {},
    risk: route.risk ? {
      level: route.risk.level || route.risk.riskLevel || 'low',
      riskLevel: route.risk.riskLevel || route.risk.level || 'low',
      secretDetected: Boolean(route.risk.secretDetected),
      actionRequested: Boolean(route.risk.actionRequested),
      writeOrExternalIntent: Boolean(route.risk.writeOrExternalIntent),
      dangerIntent: Boolean(route.risk.dangerIntent),
      sanitizedText: truncateText(route.risk.sanitizedText || '', 220),
      reasons: Array.isArray(route.risk.reasons) ? route.risk.reasons.slice(0, 10).map(item => truncateText(item, 120)) : []
    } : null,
    scores: Array.isArray(route.scores) ? route.scores.slice(0, 12).map(item => ({
      agentId: truncateText(item.agentId || '', 80),
      score: Number(item.score || 0),
      reason: truncateText(item.reason || '', 180)
    })) : [],
    policy: route.policy ? {
      mode: route.policy.mode || 'natural_smart',
      selectedAgents: Array.isArray(route.policy.selectedAgents) ? route.policy.selectedAgents.slice(0, 20) : [],
      internalOnlyAgents: Array.isArray(route.policy.internalOnlyAgents) ? route.policy.internalOnlyAgents.slice(0, 20) : [],
      mutedAgents: Array.isArray(route.policy.mutedAgents) ? route.policy.mutedAgents.slice(0, 30) : [],
      maxVisibleReplies: Number(route.policy.maxVisibleReplies || 3),
      requireOrchestratorSummary: Boolean(route.policy.requireOrchestratorSummary),
      riskLevel: route.policy.riskLevel || 'low',
      approvalRequired: Boolean(route.policy.approvalRequired),
      reason: truncateText(route.policy.reason || '', 260)
    } : null,
    selectedAgents: Array.isArray(route.selectedAgents) ? route.selectedAgents.slice(0, 20).map(item => truncateText(item, 80)) : [],
    internalOnlyAgents: Array.isArray(route.internalOnlyAgents) ? route.internalOnlyAgents.slice(0, 20).map(item => truncateText(item, 80)) : [],
    mutedAgents: Array.isArray(route.mutedAgents) ? route.mutedAgents.slice(0, 30).map(item => truncateText(item, 80)) : [],
    approvalRequired: Boolean(route.approvalRequired),
    reason: truncateText(route.reason || '', 260)
  });
}

function sanitizeAgentActivity(item = {}) {
  return guards.preventSecretLeak({
    id: truncateText(item.id || '', 120),
    chatId: truncateText(item.chatId || '', 80),
    userId: truncateText(item.userId || '', 80),
    botId: truncateText(item.botId || '', 80),
    topics: Array.isArray(item.topics) ? item.topics.slice(0, 20).map(topic => truncateText(topic, 80)) : [],
    riskLevel: item.riskLevel || 'low',
    mode: item.mode || 'natural_smart',
    selectedAgents: Array.isArray(item.selectedAgents) ? item.selectedAgents.slice(0, 20).map(id => truncateText(id, 80)) : [],
    internalOnlyAgents: Array.isArray(item.internalOnlyAgents) ? item.internalOnlyAgents.slice(0, 20).map(id => truncateText(id, 80)) : [],
    mutedAgents: Array.isArray(item.mutedAgents) ? item.mutedAgents.slice(0, 30).map(id => truncateText(id, 80)) : [],
    reason: truncateText(item.reason || '', 260),
    messagePreview: truncateText(item.messagePreview || '', 220),
    responseCount: Number(item.responseCount || 0),
    createdAt: item.createdAt || null
  });
}

function sanitizeAgentGroupSettings(settings = {}) {
  return guards.preventSecretLeak({
    chatId: truncateText(settings.chatId || '', 80),
    mode: settings.mode || 'natural_smart',
    maxAutoAgents: Number(settings.maxAutoAgents || 3),
    allowAllAgents: Boolean(settings.allowAllAgents),
    orchestratorBotId: truncateText(settings.orchestratorBotId || 'default', 80),
    updatedBy: truncateText(settings.updatedBy || '', 80),
    updatedAt: settings.updatedAt || null
  });
}

function sanitizeDashboardSummary(data = {}) {
  return guards.preventSecretLeak({
    totalUsers: Number(data.totalUsers || 0),
    memoryCount: Number(data.memoryCount || 0),
    goalCount: Number(data.goalCount || 0),
    workflowCount: Number(data.workflowCount || 0),
    insightCount: Number(data.insightCount || 0),
    graphNodeCount: Number(data.graphNodeCount || 0),
    graphEdgeCount: Number(data.graphEdgeCount || 0),
    storageStatus: data.storageStatus ? sanitizeStorage(data.storageStatus) : null,
    opsStatus: data.opsStatus || null
  });
}

function normalizeStorageHealth(storage = {}) {
  const postgres = storage.postgres || {};
  const postgresHealth = postgres.health || postgres || {};
  const redis = storage.redis || storage.cache || {};
  const redisHealth = redis.health || redis || {};
  return {
    storageDriver: storage.driver || storage.storageDriver || storage.persistentType || 'unknown',
    activeDriver: storage.activeDriver || storage.driver || storage.storageDriver || storage.persistentType || 'unknown',
    configuredStorageDriver: storage.configuredDriver || storage.preferredDriver || 'auto',
    fallbackActive: Boolean(storage.fallbackActive || storage.fallback),
    fallbackReason: truncateText(storage.fallbackReason || '', 180),
    jsonFallbackAvailable: storage.jsonFallbackAvailable !== false,
    databaseUrlConfigured: Boolean(storage.postgresConfigured || postgresHealth.configured),
    postgresAvailable: Boolean(storage.postgresAvailable || postgresHealth.available),
    postgresTableReady: Boolean(storage.postgresTableReady || postgresHealth.tableReady),
    postgresStatus: postgresHealth.status || (postgresHealth.available ? 'connected' : 'unavailable'),
    postgresLatencyMs: postgresHealth.latencyMs ?? null,
    postgresRecommendedFix: truncateText(postgresHealth.recommendedFix || '', 240),
    redisUrlConfigured: Boolean(storage.redisConfigured || redisHealth.configured),
    redisAvailable: Boolean(storage.redisAvailable || redis.redisAvailable || redisHealth.available),
    redisStatus: redisHealth.status || (redisHealth.available ? 'connected' : 'unavailable'),
    redisLatencyMs: redisHealth.latencyMs ?? null,
    redisRecommendedFix: truncateText(redisHealth.recommendedFix || '', 240)
  };
}

function sanitizeStorage(storage = {}) {
  const normalized = normalizeStorageHealth(storage);
  const postgres = storage.postgres || {};
  const postgresHealth = postgres.health || {};
  const redis = storage.redis || storage.cache || {};
  const redisHealth = redis.health || {};
  return guards.preventSecretLeak({
    ...normalized,
    initialized: Boolean(storage.initialized),
    activeDriver: normalized.activeDriver,
    migrations: storage.migrations || postgres.migrations || 'skipped',
    fallbackReason: normalized.fallbackReason,
    jsonFallbackAvailable: normalized.jsonFallbackAvailable,
    lastError: truncateText(storage.lastError || '', 160),
    postgres: {
      configured: normalized.databaseUrlConfigured,
      available: normalized.postgresAvailable,
      tableReady: normalized.postgresTableReady,
      status: normalized.postgresStatus,
      latencyMs: normalized.postgresLatencyMs,
      errorMessageSafe: truncateText(postgresHealth.errorMessageSafe || postgres.errorMessageSafe || '', 160),
      recommendedFix: normalized.postgresRecommendedFix
    },
    redis: {
      configured: normalized.redisUrlConfigured,
      available: normalized.redisAvailable,
      status: normalized.redisStatus,
      latencyMs: normalized.redisLatencyMs,
      errorMessageSafe: truncateText(redisHealth.errorMessageSafe || redis.errorMessageSafe || '', 160),
      recommendedFix: normalized.redisRecommendedFix
    },
    cacheFallback: redis.fallback ? { type: redis.fallback.type, available: Boolean(redis.fallback.available), size: Number(redis.fallback.size || 0) } : null
  });
}

function sanitizeHealth(data = {}) {
  const storage = sanitizeStorage(data.storage || data.storageStatus || data);
  return guards.preventSecretLeak({
    ok: Boolean(data.ok),
    uptime: Number(data.uptime || 0),
    timestamp: data.timestamp || null,
    version: data.version || 'unknown',
    dashboardEnabled: Boolean(data.dashboardEnabled),
    tokenConfigured: Boolean(data.tokenConfigured ?? data.adminTokenSet),
    storageDriver: data.storageDriver || storage.storageDriver || 'unknown',
    activeDriver: data.activeDriver || storage.activeDriver || data.storageDriver || storage.storageDriver || 'unknown',
    configuredStorageDriver: data.configuredStorageDriver || storage.configuredStorageDriver || 'auto',
    fallbackActive: Boolean(data.fallbackActive ?? storage.fallbackActive),
    fallbackReason: truncateText(data.fallbackReason || storage.fallbackReason || '', 180),
    jsonFallbackAvailable: Boolean(data.jsonFallbackAvailable ?? storage.jsonFallbackAvailable),
    databaseUrlConfigured: Boolean(data.databaseUrlConfigured ?? storage.databaseUrlConfigured),
    postgresAvailable: Boolean(data.postgresAvailable ?? storage.postgresAvailable),
    postgresTableReady: Boolean(data.postgresTableReady ?? storage.postgresTableReady),
    postgresStatus: data.postgresStatus || storage.postgresStatus || 'unavailable',
    postgresLatencyMs: data.postgresLatencyMs ?? storage.postgresLatencyMs ?? null,
    postgresRecommendedFix: truncateText(data.postgresRecommendedFix || storage.postgresRecommendedFix || '', 240),
    redisUrlConfigured: Boolean(data.redisUrlConfigured ?? storage.redisUrlConfigured),
    redisAvailable: Boolean(data.redisAvailable ?? storage.redisAvailable),
    redisStatus: data.redisStatus || storage.redisStatus || 'unavailable',
    redisLatencyMs: data.redisLatencyMs ?? storage.redisLatencyMs ?? null,
    redisRecommendedFix: truncateText(data.redisRecommendedFix || storage.redisRecommendedFix || '', 240)
  });
}

function sanitizeOps(data = {}) {
  return sanitizeOpsData(data);
}

function sanitizeReliability(data = {}) {
  if (!data) return null;
  return guards.preventSecretLeak({
    score: Number(data.score ?? 0),
    overallScore: Number(data.overallScore ?? data.overall ?? data.score ?? 0),
    status: data.status || 'unknown',
    strongestArea: data.strongestArea || null,
    weakestArea: data.weakestArea || null,
    recommendedFixes: Array.isArray(data.recommendedFixes) ? data.recommendedFixes.slice(0, 8).map(item => truncateText(item, 180)) : [],
    lastUpdated: data.lastUpdated || data.generatedAt || null
  });
}

function sanitizeBenchmark(run = {}) {
  if (!run) return null;
  return guards.preventSecretLeak({
    id: run.id,
    type: run.type,
    status: run.status,
    createdAt: run.createdAt,
    score: Number(run.score ?? 0),
    passed: Boolean(run.passed),
    caseCount: Number(run.caseCount ?? 0),
    regressionAgainstBaseline: Boolean(run.regressionAgainstBaseline),
    results: Array.isArray(run.results) ? run.results.slice(0, 50).map(res => ({
      id: res.id,
      type: res.type,
      status: res.status,
      passed: Boolean(res.passed),
      title: truncateText(res.title || '', 120),
      score: Number(res.score ?? 0),
      latencyMs: Number(res.latencyMs ?? 0),
      notes: truncateText(res.notes || '', 240)
    })) : []
  });
}

function sanitizeIncident(inc = {}) {
  if (!inc) return null;
  return guards.preventSecretLeak({
    id: inc.id,
    title: truncateText(inc.title || '', 120),
    category: inc.category || 'ops',
    status: inc.status || 'open',
    severity: inc.severity || 'info',
    suspectedCause: truncateText(inc.suspectedCause || '', 240),
    recommendedFixes: Array.isArray(inc.recommendedFixes) ? inc.recommendedFixes.slice(0, 5).map(f => truncateText(f, 200)) : [],
    createdAt: inc.createdAt,
    resolvedAt: inc.resolvedAt
  });
}

function sanitizePerformance(data = {}) {
  return guards.preventSecretLeak({
    sampleCount: Number(data.sampleCount || 0),
    slowOperations: Array.isArray(data.slowOperations) ? data.slowOperations.slice(0, 10) : [],
    scopes: Array.isArray(data.scopes) ? data.scopes.slice(0, 12) : [],
    latency: data.latency || null,
    bottleneck: truncateText(data.bottleneck || '', 80),
    generatedAt: data.generatedAt || null
  });
}

function sanitizeCommandList(cmds = {}) {
  const out = {};
  for (const [category, list] of Object.entries(cmds)) {
    if (Array.isArray(list)) {
      out[category] = list.slice(0, 100).map(cmd => truncateText(cmd, 60));
    }
  }
  return out;
}

function sanitizeUserOverview(data = {}) {
  return guards.preventSecretLeak({
    workspaceId: data.workspaceId || null,
    actorRole: data.actorRole || null,
    memoryStats: data.memoryStats || null,
    activeGoals: Array.isArray(data.activeGoals) ? data.activeGoals.map(sanitizeGoal) : [],
    activeWorkflows: Array.isArray(data.activeWorkflows) ? data.activeWorkflows.map(sanitizeWorkflow) : [],
    recentInsights: Array.isArray(data.recentInsights) ? data.recentInsights.map(sanitizeInsight) : [],
    graphStats: data.graphStats || null,
    adaptiveProfileSummary: data.adaptiveProfileSummary || null
  });
}

function sanitizeGraph(graph = {}) {
  return guards.preventSecretLeak({
    stats: graph.stats || { nodes: 0, edges: 0 },
    summaryText: truncateText(graph.summaryText || '', 500),
    topNodes: Array.isArray(graph.topNodes) ? graph.topNodes.slice(0, 50).map(sanitizeGraphNode) : [],
    topEdges: Array.isArray(graph.topEdges) ? graph.topEdges.slice(0, 50).map(sanitizeGraphEdge) : []
  });
}

function sanitizeAuditEntry(entry = {}) {
  return guards.preventSecretLeak({
    id: entry.id,
    actorType: entry.actorType || 'dashboard',
    actorId: truncateText(entry.actorId || '', 80),
    action: truncateText(entry.action || '', 80),
    targetType: truncateText(entry.targetType || '', 40),
    targetId: truncateText(entry.targetId || '', 120),
    userId: truncateText(entry.userId || '', 80),
    workspaceId: truncateText(entry.workspaceId || '', 120),
    actorRole: truncateText(entry.actorRole || '', 40),
    permission: truncateText(entry.permission || '', 40),
    decision: entry.decision || null,
    status: entry.status || 'ok',
    beforeSummary: guards.sanitizeBeforeAfterSummary(entry.beforeSummary || ''),
    afterSummary: guards.sanitizeBeforeAfterSummary(entry.afterSummary || ''),
    reason: truncateText(entry.reason || '', 240),
    ipHash: entry.ipHash || '',
    userAgentSummary: truncateText(entry.userAgentSummary || '', 160),
    createdAt: entry.createdAt
  });
}

function sanitizeMember(member = {}) {
  return guards.preventSecretLeak({
    userId: truncateText(member.userId || member.user_id || '', 80),
    role: truncateText(member.role || 'viewer', 40),
    status: member.status || 'active',
    addedAt: member.addedAt || member.added_at || null,
    updatedAt: member.updatedAt || member.updated_at || null
  });
}

function sanitizeWorkspace(workspace = {}) {
  return guards.preventSecretLeak({
    id: truncateText(workspace.id || '', 120),
    name: truncateText(workspace.name || '', 120),
    description: truncateText(workspace.description || '', 500),
    type: workspace.type || 'project',
    ownerId: truncateText(workspace.ownerId || workspace.owner_id || '', 80),
    members: Array.isArray(workspace.members) ? workspace.members.slice(0, 100).map(sanitizeMember) : [],
    createdAt: workspace.createdAt || workspace.created_at || null,
    updatedAt: workspace.updatedAt || workspace.updated_at || null,
    archivedAt: workspace.archivedAt || workspace.archived_at || null
  });
}

function sanitizePermissionSummary(summary = {}) {
  return guards.preventSecretLeak({
    userId: truncateText(summary.userId || '', 80),
    workspaceId: truncateText(summary.workspaceId || '', 120),
    role: summary.role || 'none',
    permissions: Array.isArray(summary.permissions) ? summary.permissions.slice(0, 12).map(item => truncateText(item, 40)) : [],
    canRead: Boolean(summary.canRead),
    canWrite: Boolean(summary.canWrite),
    canDanger: Boolean(summary.canDanger),
    canOps: Boolean(summary.canOps),
    canManageMembers: Boolean(summary.canManageMembers)
  });
}

function sanitizeActionResult(result = {}) {
  return guards.preventSecretLeak({
    ok: Boolean(result.ok),
    action: result.action,
    status: result.status,
    result: result.result || null,
    warnings: Array.isArray(result.warnings) ? result.warnings.slice(0, 10).map(item => truncateText(item, 160)) : [],
    timestamp: result.timestamp || null
  });
}

module.exports = {
  sanitizeAgentActivity,
  sanitizeAgentGroupSettings,
  sanitizeAgentLearningNote,
  sanitizeAgentMemory,
  sanitizeAgentPreferences,
  sanitizeAgentProfile,
  sanitizeAgentPromptPreview,
  sanitizeAgentRoutingResult,
  sanitizeAgentSummary,
  sanitizeBotConfig,
  sanitizeEnvStatus,
  sanitizeExecutionAction,
  sanitizeExecutionProposal,
  sanitizeExecutionRun,
  sanitizeGoal,
  sanitizeGraphEdge,
  sanitizeGraphNode,
  sanitizeInsight,
  sanitizeMemory,
  sanitizeMilestone,
  sanitizeOpsData,
  sanitizePlan,
  sanitizeTask,
  sanitizeToolAudit,
  sanitizeToolMetadata,
  sanitizeToolRun,
  sanitizeWorkflow,
  truncateText,
  sanitizeDashboardSummary,
  sanitizeHealth,
  sanitizeStorage,
  sanitizeOps,
  sanitizeReliability,
  sanitizeBenchmark,
  sanitizeBackupManifest,
  sanitizeBackupSchedule,
  sanitizeBackupScheduleRun,
  sanitizeBackupSnapshot,
  sanitizeIncident,
  sanitizePerformance,
  sanitizeCommandList,
  sanitizeUserOverview,
  sanitizeGraph,
  sanitizeAuditEntry,
  sanitizeActionResult,
  sanitizeMember,
  sanitizePermissionSummary,
  sanitizeRestorePlan,
  sanitizeWorkspace
};
