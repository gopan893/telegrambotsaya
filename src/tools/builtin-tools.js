'use strict';

const axios = require('axios');
const registry = require('./tool-registry');
const utils = require('./tool-utils');

const registeredServices = new WeakSet();

function env(services = {}) {
  return services.env || process.env;
}

function hasFn(value) {
  return typeof value === 'function';
}

async function weatherLookup(input = {}, context = {}, services = {}) {
  const city = utils.compactText(input.city || input.query || input.text || '', 120);
  if (!city) return { ok: false, error: 'CITY_REQUIRED' };
  const key = env(services).OPENWEATHER_API_KEY;
  if (!key) return { ok: false, error: 'OPENWEATHER_API_KEY_MISSING' };
  const res = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
    params: { q: city, appid: key, units: 'metric', lang: 'id' },
    timeout: 8000
  });
  const data = res.data || {};
  return {
    ok: true,
    result: {
      city: data.name || city,
      temperatureC: data.main?.temp,
      description: data.weather?.[0]?.description || '',
      humidity: data.main?.humidity,
      windSpeed: data.wind?.speed,
      text: `Cuaca ${data.name || city}: ${data.main?.temp ?? '-'}°C, ${data.weather?.[0]?.description || 'tidak tersedia'}`
    }
  };
}

async function searchWeb(input = {}, context = {}, services = {}) {
  const query = utils.compactText(input.query || input.text || '', 240);
  if (!query) return { ok: false, error: 'QUERY_REQUIRED' };
  const key = env(services).TAVILY_API_KEY;
  if (!key) return { ok: false, error: 'TAVILY_API_KEY_MISSING' };
  const res = await axios.post('https://api.tavily.com/search', {
    api_key: key,
    query,
    max_results: Math.min(Number(input.maxResults || 5), 8),
    search_depth: 'basic',
    include_answer: true
  }, { timeout: 10000 });
  return {
    ok: true,
    result: {
      query,
      answer: res.data?.answer || '',
      results: (res.data?.results || []).slice(0, 5).map(item => ({
        title: item.title,
        url: item.url,
        content: utils.compactText(item.content || '', 500)
      }))
    }
  };
}

async function dashboardAction(input = {}, context = {}, services = {}, actionName) {
  const actions = require('../dashboard/dashboard-actions');
  const result = await actions.handleAction(actionName, services, input || {});
  return { ok: result?.ok !== false, result };
}

async function plannerMarkDone(input = {}, context = {}, services = {}) {
  const planner = require('../planner');
  const result = await planner.taskOrchestrator.markTaskDone(input.taskId || context.targetId, {
    ...services,
    actorId: context.actorId || services.actorId || context.userId
  });
  return { ok: result.ok, result };
}

async function plannerMarkBlocked(input = {}, context = {}, services = {}) {
  const planner = require('../planner');
  const result = await planner.taskOrchestrator.markTaskBlocked(input.taskId || context.targetId, input.reason || 'Blocked via tool registry.', {
    ...services,
    actorId: context.actorId || services.actorId || context.userId
  });
  return { ok: result.ok, result };
}

async function workflowStepAdd(input = {}, context = {}, services = {}) {
  const repos = services.storageManager?.getRepositories?.();
  const userId = context.userId || services.actorId || input.userId || '';
  const workflowId = input.workflowId || context.targetId;
  if (!workflowId) return { ok: false, error: 'WORKFLOW_ID_REQUIRED' };
  if (repos?.workflows?.addWorkflowStep) {
    const step = await repos.workflows.addWorkflowStep({
      userId,
      workflowId,
      title: input.title || input.text || 'Tool registry workflow step',
      description: input.description || '',
      metadata: { workspaceId: context.workspaceId || input.workspaceId || '' }
    });
    return { ok: Boolean(step), result: step };
  }
  return { ok: false, error: 'WORKFLOW_REPOSITORY_UNAVAILABLE' };
}

async function workflowStepDone(input = {}, context = {}, services = {}) {
  const repos = services.storageManager?.getRepositories?.();
  const userId = context.userId || services.actorId || input.userId || '';
  const workflowId = input.workflowId || context.targetId;
  const stepNumber = input.stepNumber || input.step || input.stepId;
  if (!workflowId || !stepNumber) return { ok: false, error: 'WORKFLOW_STEP_REQUIRED' };
  if (repos?.workflows?.completeWorkflowStep) {
    const step = await repos.workflows.completeWorkflowStep(userId, workflowId, stepNumber);
    return { ok: Boolean(step), result: step };
  }
  return { ok: false, error: 'WORKFLOW_REPOSITORY_UNAVAILABLE' };
}

async function goalProgressUpdate(input = {}, context = {}, services = {}) {
  const repos = services.storageManager?.getRepositories?.();
  const userId = context.userId || services.actorId || input.userId || '';
  const goalId = input.goalId || context.targetId;
  const progress = Number(input.progress);
  if (!goalId || !Number.isFinite(progress)) return { ok: false, error: 'GOAL_PROGRESS_REQUIRED' };
  if (repos?.goals?.updateGoal) {
    const goal = await repos.goals.updateGoal(userId, goalId, { progress });
    return { ok: Boolean(goal), result: goal };
  }
  return { ok: false, error: 'GOAL_REPOSITORY_UNAVAILABLE' };
}

async function memorySuggestArchive(input = {}) {
  return {
    ok: true,
    result: {
      recommendation: 'Archive suggestion only. No memory was archived automatically.',
      memoryId: input.memoryId || ''
    }
  };
}

async function graphSearch(input = {}, context = {}, services = {}) {
  const userId = context.userId || services.actorId || input.userId || '';
  const query = input.query || input.text || '';
  const graph = services.aiOS?.knowledgeGraph;
  if (!graph?.searchGraph && !graph?.listNodes) return { ok: false, error: 'GRAPH_UNAVAILABLE' };
  const result = graph.searchGraph
    ? graph.searchGraph(userId, query, services, Math.min(Number(input.limit || 8), 12))
    : graph.listNodes(userId, { query, limit: Math.min(Number(input.limit || 8), 12) }, services);
  return { ok: true, result };
}

async function graphSummarize(input = {}, context = {}, services = {}) {
  const userId = context.userId || services.actorId || input.userId || '';
  const summarizer = services.aiOS?.graphSummarizer;
  if (summarizer?.summarizeProjectGraph) return { ok: true, result: summarizer.summarizeProjectGraph(userId, {}, services) };
  if (services.aiOS?.knowledgeGraph?.getGraphStats) return { ok: true, result: services.aiOS.knowledgeGraph.getGraphStats(userId, services) };
  return { ok: false, error: 'GRAPH_SUMMARIZER_UNAVAILABLE' };
}

async function backupCreate(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  const actorId = context.actorId || services.actorId || input.actorId || '';
  const userId = context.userId || input.userId || actorId;
  const workspaceId = context.workspaceId || input.workspaceId || '';
  const type = input.type || 'workspace';
  if (type === 'user') return backup.backupEngine.createUserBackup(userId, { ...input, actorId, workspaceId }, services);
  if (type === 'system' || type === 'full_safe') return backup.backupEngine.createSystemSafeBackup({ ...input, actorId, userId, workspaceId }, services);
  return backup.backupEngine.createWorkspaceBackup(workspaceId, { ...input, actorId, userId }, services);
}

async function backupValidate(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.backupEngine.validateBackup(input.backupId || context.targetId, services);
}

async function backupExport(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.exportEngine.exportBackupJson(input.backupId || context.targetId, services);
}

async function importValidate(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.importValidator.validateImportPayload(input.payload || input, services);
}

async function restorePlan(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.restoreEngine.createRestorePlan(input.backupId || input.payload || input.importPayload || {}, {
    actorId: context.actorId || services.actorId || input.actorId || '',
    userId: context.userId || input.userId || '',
    workspaceId: context.workspaceId || input.workspaceId || '',
    allowOverwrite: Boolean(input.allowOverwrite)
  }, services);
}

async function recoveryCheck(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.disasterRecovery.runDisasterRecoveryCheck(services);
}

async function integrityCheck(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.integrityChecker.runIntegrityCheck({
    userId: context.userId || input.userId || '',
    workspaceId: context.workspaceId || input.workspaceId || ''
  }, services);
}

async function pwaStatus(input = {}, context = {}, services = {}) {
  return {
    ok: true,
    result: {
      manifestUrl: '/dashboard/manifest.webmanifest',
      serviceWorkerScope: '/dashboard',
      staticAssetsOnly: true,
      cachesApiResponses: false
    }
  };
}

async function backupScheduleCreate(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.backupScheduler.createBackupSchedule({
    ...input,
    actorId: context.actorId || services.actorId || input.actorId || '',
    userId: context.userId || input.userId || '',
    workspaceId: context.workspaceId || input.workspaceId || ''
  }, services);
}

async function backupSchedulePreview(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.backupScheduler.previewScheduleRun(input.scheduleId || context.targetId, services);
}

async function backupScheduleRequestRun(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.backupScheduler.requestScheduleRunApproval(input.scheduleId || context.targetId, services);
}

async function backupScheduleApproveRun(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.backupScheduler.approveScheduleRun(input.runId || context.targetId, {
    actorId: context.actorId || services.actorId || input.actorId || ''
  }, services);
}

async function backupScheduleRunApproved(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return backup.backupScheduler.runApprovedSchedule(input.runId || context.targetId, services);
}

async function backupDownloadPrepare(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  const result = await backup.exportEngine.exportBackupJson(input.backupId || context.targetId, services);
  if (!result.ok) return result;
  return {
    ok: true,
    result: {
      fileName: result.fileName,
      manifest: result.payload?.manifest || {},
      sizeEstimateBytes: Buffer.byteLength(JSON.stringify(result.payload || {}), 'utf8'),
      secretsExcluded: true
    }
  };
}

async function importPreview(input = {}, context = {}, services = {}) {
  const backup = require('../backup');
  return { ok: true, result: await backup.importValidator.buildImportPreview(input.payload || input, services) };
}

function tool(id, patch = {}) {
  return {
    id,
    name: patch.name || id,
    description: patch.description || id,
    category: patch.category || 'utility',
    source: 'builtin',
    actionType: patch.actionType || id,
    riskLevel: patch.riskLevel || 'low',
    permissionsRequired: patch.permissionsRequired || ['read'],
    requiresApproval: patch.requiresApproval ?? false,
    workspaceAware: true,
    inputSchema: patch.inputSchema || {},
    outputSchema: patch.outputSchema || {},
    enabled: patch.enabled !== false,
    unavailableReason: patch.unavailableReason || '',
    rateLimit: patch.rateLimit || { windowMs: 60000, max: 20 },
    timeoutMs: patch.timeoutMs || 10000
  };
}

async function registerBuiltInTools(services = {}, options = {}) {
  const marker = services.storageManager && typeof services.storageManager === 'object' ? services.storageManager : services;
  if (!options.force && marker && typeof marker === 'object' && registeredServices.has(marker)) return { ok: true, skipped: true };
  const e = env(services);
  const items = [
    [tool('weather.lookup', {
      name: 'Weather Lookup',
      description: 'Lookup current weather by city using OpenWeather when configured.',
      category: 'weather',
      enabled: Boolean(e.OPENWEATHER_API_KEY),
      unavailableReason: e.OPENWEATHER_API_KEY ? '' : 'OPENWEATHER_API_KEY_MISSING',
      inputSchema: { type: 'object', required: ['city'], properties: { city: { type: 'string' } } }
    }), weatherLookup],
    [tool('search.web', {
      name: 'Web Search',
      description: 'Search the web using Tavily when configured.',
      category: 'search',
      enabled: Boolean(e.TAVILY_API_KEY),
      unavailableReason: e.TAVILY_API_KEY ? '' : 'TAVILY_API_KEY_MISSING',
      inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
      rateLimit: { windowMs: 60000, max: 10 }
    }), searchWeb],
    [tool('ops.diagnostics.run', { category: 'ops', description: 'Run diagnostics.', permissionsRequired: ['read'], requiresApproval: false }), (input, context, svc) => dashboardAction(input, context, svc, 'diagnostics/run')],
    [tool('ops.benchmark.light', { category: 'ops', description: 'Run light benchmark.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true }), (input, context, svc) => dashboardAction(input, context, svc, 'benchmark/run-light')],
    [tool('report.health.export', { category: 'report', description: 'Build sanitized health report.' }), (input, context, svc) => dashboardAction(input, context, svc, 'report/export-health')],
    [tool('report.user_summary.export', { category: 'report', description: 'Build sanitized user summary.', inputSchema: { type: 'object', properties: { userId: { type: 'string' } } } }), (input, context, svc) => dashboardAction(input, context, svc, 'report/export-user-summary')],
    [tool('planner.task.mark_done', { category: 'planner', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true, inputSchema: { type: 'object', required: ['taskId'] } }), plannerMarkDone],
    [tool('planner.task.mark_blocked', { category: 'planner', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true, inputSchema: { type: 'object', required: ['taskId'] } }), plannerMarkBlocked],
    [tool('workflow.step.add', { category: 'workflow', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true }), workflowStepAdd],
    [tool('workflow.step.done', { category: 'workflow', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true }), workflowStepDone],
    [tool('goal.progress.update', { category: 'goal', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true, inputSchema: { type: 'object', required: ['goalId', 'progress'] } }), goalProgressUpdate],
    [tool('memory.suggest_archive', { category: 'memory', riskLevel: 'low', permissionsRequired: ['read'], requiresApproval: false }), memorySuggestArchive],
    [tool('graph.search', { category: 'graph', riskLevel: 'low', permissionsRequired: ['read'], requiresApproval: false }), graphSearch],
    [tool('graph.summarize', { category: 'graph', riskLevel: 'low', permissionsRequired: ['read'], requiresApproval: false }), graphSummarize],
    [tool('backup.create', { category: 'utility', description: 'Create a sanitized backup.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true }), backupCreate],
    [tool('backup.validate', { category: 'utility', description: 'Validate backup checksum and safety.', permissionsRequired: ['read'], requiresApproval: false, inputSchema: { type: 'object', required: ['backupId'] } }), backupValidate],
    [tool('backup.export', { category: 'utility', description: 'Export sanitized backup JSON.', permissionsRequired: ['read'], requiresApproval: false, inputSchema: { type: 'object', required: ['backupId'] } }), backupExport],
    [tool('import.validate', { category: 'utility', description: 'Validate import payload.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true }), importValidate],
    [tool('restore.plan', { category: 'utility', description: 'Create restore plan. Does not restore automatically.', riskLevel: 'danger', permissionsRequired: ['danger'], requiresApproval: true }), restorePlan],
    [tool('recovery.check', { category: 'ops', description: 'Run disaster recovery readiness check.', permissionsRequired: ['read'], requiresApproval: false }), recoveryCheck],
    [tool('integrity.check', { category: 'ops', description: 'Run data integrity check.', permissionsRequired: ['read'], requiresApproval: false }), integrityCheck],
    [tool('pwa.status', { category: 'dashboard', description: 'Show PWA cache and install status.', permissionsRequired: ['read'], requiresApproval: false }), pwaStatus],
    [tool('backup.schedule.create', { category: 'utility', description: 'Create approved backup schedule.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true }), backupScheduleCreate],
    [tool('backup.schedule.preview', { category: 'utility', description: 'Preview schedule run without creating backup.', permissionsRequired: ['read'], requiresApproval: false, inputSchema: { type: 'object', required: ['scheduleId'] } }), backupSchedulePreview],
    [tool('backup.schedule.request_run', { category: 'utility', description: 'Request approval for backup schedule run.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true, inputSchema: { type: 'object', required: ['scheduleId'] } }), backupScheduleRequestRun],
    [tool('backup.schedule.approve_run', { category: 'utility', description: 'Approve pending backup schedule run.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true, inputSchema: { type: 'object', required: ['runId'] } }), backupScheduleApproveRun],
    [tool('backup.schedule.run_approved', { category: 'utility', description: 'Run an approved backup schedule.', riskLevel: 'medium', permissionsRequired: ['write'], requiresApproval: true, inputSchema: { type: 'object', required: ['runId'] } }), backupScheduleRunApproved],
    [tool('backup.download.prepare', { category: 'utility', description: 'Prepare sanitized backup download metadata.', permissionsRequired: ['read'], requiresApproval: false, inputSchema: { type: 'object', required: ['backupId'] } }), backupDownloadPrepare],
    [tool('import.preview', { category: 'utility', description: 'Preview sanitized backup import payload.', permissionsRequired: ['read'], requiresApproval: false }), importPreview]
  ];

  for (const [meta, handler] of items) {
    const available = typeof handler === 'function';
    await registry.registerTool({
      ...meta,
      enabled: meta.enabled !== false && available,
      unavailableReason: available ? meta.unavailableReason : 'HANDLER_UNAVAILABLE'
    }, handler, services);
  }
  if (marker && typeof marker === 'object') registeredServices.add(marker);
  return { ok: true, count: items.length };
}

function resetBuiltInRegistrationForTests() {
  // WeakSet cannot be cleared; tests can call registerBuiltInTools with { force: true }.
}

module.exports = {
  registerBuiltInTools,
  resetBuiltInRegistrationForTests
};
