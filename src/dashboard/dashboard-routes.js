'use strict';

const express = require('express');
const path = require('path');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const utils = require('./dashboard-utils');
const actions = require('./dashboard-actions');
const auditLog = require('./audit-log');
const permissions = require('./dashboard-permissions');
const safeActions = require('./safe-actions');
const workspace = require('../workspace');
const workspaceRoutes = require('./workspace-routes');
const plannerRoutes = require('./planner-routes');
const executorRoutes = require('./executor-routes');
const toolRoutes = require('./tool-routes');
const backupRoutes = require('./backup-routes');
const pwaRoutes = require('./pwa-routes');
const agentMemoryRoutes = require('./agent-memory-routes');
const councilRoutes = require('./council-routes');
const agentRoutes = require('./agent-routes');
const agentTaskRoutes = require('./agent-task-routes');
const decisionRoutes = require('./decision-routes');
const agentExecutorRoutes = require('./agent-executor-routes');
const agentEvaluationRoutes = require('./agent-evaluation-routes');
const integrationExecutionRoutes = require('./integration-execution-routes');
const selfhealingRoutes = require('./selfhealing-routes');
const monitoringRoutes = require('./monitoring-routes');
const cicdRoutes = require('./cicd-routes');
const routineRoutes = require('./routine-routes');
const observabilityRoutes = require('./observability-routes');
let costRoutes;
try {
  costRoutes = require('./cost-routes');
} catch (e) {
  costRoutes = { registerCostRoutes: () => {} };
}
let knowledgeRoutes;
try {
  knowledgeRoutes = require('./knowledge-routes');
} catch (e) {
  knowledgeRoutes = { registerKnowledgeRoutes: () => {} };
}

function getDashboardServices(services = {}) {
  return {
    env: services.env || services.config || process.env,
    storageManager: services.storageManager || null,
    aiOS: services.aiOS || {},
    opsSystem: services.opsSystem || null,
    integrationsSystem: services.integrationsSystem || null,
    selfHealingSystem: services.selfHealingSystem || null,
    evaluationSystem: services.evaluationSystem || null,
    executorSystem: services.executorSystem || null,
    monitoringSystem: services.monitoringSystem || null,
    observabilitySystem: services.observabilitySystem || null,
    cicdSystem: services.cicdSystem || null,
    autoHealingSystem: services.autoHealingSystem || null,
    routineRegistry: services.routineRegistry || null,
    routineRunner: services.routineRunner || null,
    routineScheduler: services.routineScheduler || null,
    getOpsServices: services.getOpsServices,
    getCalendarClient: services.getCalendarClient,
    ensureUser: services.ensureUser,
    getUsersSnapshot: services.getUsersSnapshot,
    auditLog,
    logger: services.logger || services.log || console
  };
}

function getStorageStatus(storageManager) {
  try {
    return storageManager?.getStorageStatus?.() || storageManager?.status?.() || {};
  } catch (err) {
    return { status: 'unavailable', error: err.message };
  }
}

function buildDashboardHealthPayload(storage, dashboardStatus) {
  const storageSafe = serializers.sanitizeStorage(storage || {});
  return {
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: utils.getVersion(),
    dashboardEnabled: dashboardStatus.enabled,
    tokenConfigured: dashboardStatus.tokenConfigured,
    storageDriver: storageSafe.storageDriver,
    activeDriver: storageSafe.activeDriver,
    configuredStorageDriver: storageSafe.configuredStorageDriver,
    fallbackActive: storageSafe.fallbackActive,
    fallbackReason: storageSafe.fallbackReason,
    jsonFallbackAvailable: storageSafe.jsonFallbackAvailable,
    databaseUrlConfigured: storageSafe.databaseUrlConfigured,
    postgresAvailable: storageSafe.postgresAvailable,
    postgresTableReady: storageSafe.postgresTableReady,
    postgresStatus: storageSafe.postgresStatus,
    postgresLatencyMs: storageSafe.postgresLatencyMs,
    postgresRecommendedFix: storageSafe.postgresRecommendedFix,
    redisUrlConfigured: storageSafe.redisUrlConfigured,
    redisAvailable: storageSafe.redisAvailable,
    redisStatus: storageSafe.redisStatus,
    redisLatencyMs: storageSafe.redisLatencyMs,
    redisRecommendedFix: storageSafe.redisRecommendedFix,
    storage: storageSafe
  };
}

function getAiosServices(services) {
  return {
    aiOS: services.aiOS,
    ensureUser: services.ensureUser,
    storageManager: services.storageManager,
    persist: () => {}
  };
}

async function safeCall(fn, fallback) {
  try {
    return await fn();
  } catch (_) {
    return fallback;
  }
}

async function resolveWorkspaceForUser(userId, workspaceId, services) {
  const cleanWorkspaceId = workspace.guards.validateWorkspaceId(workspaceId || '');
  if (cleanWorkspaceId) return workspace.store.getWorkspace(cleanWorkspaceId, services);
  return workspace.store.getDefaultWorkspaceForUser(userId, services);
}

async function ensureDashboardUserAccess(req, res, services, userId, permission = 'read') {
  const actorId = workspaceRoutes.getActorId(req, services);
  const selectedWorkspace = await resolveWorkspaceForUser(userId, req.query.workspaceId || req.body?.workspaceId || '', services);
  if (!selectedWorkspace) return { ok: false, response: guards.safeDashboardResponse(res, { ok: false, error: 'WORKSPACE_NOT_FOUND' }, 404) };
  const allowed = await workspace.permissions.canAccessUserData(actorId, userId, selectedWorkspace.id, permission, services);
  if (!allowed) {
    await auditLog.recordAuditLog({
      actorType: 'dashboard',
      actorId,
      action: `workspace/data_${permission}_denied`,
      targetType: 'user',
      targetId: userId,
      userId,
      workspaceId: selectedWorkspace.id,
      permission,
      decision: 'denied',
      status: 'denied',
      reason: 'workspace data access denied',
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    }, services);
    return { ok: false, response: guards.safeDashboardResponse(res, { ok: false, error: 'WORKSPACE_PERMISSION_DENIED' }, 403) };
  }
  const summary = await workspace.permissions.getPermissionSummary(actorId, selectedWorkspace.id, services);
  return { ok: true, actorId, workspace: selectedWorkspace, workspaceId: selectedWorkspace.id, role: summary.role, permissionSummary: summary };
}

function filterByWorkspace(items, userId, workspaceId) {
  const defaultWorkspaceId = workspace.utils.getPersonalWorkspaceId(userId);
  return workspace.guards.filterDataByWorkspace(items, workspaceId, defaultWorkspaceId);
}

function getRepositories(services) {
  try {
    return services.storageManager?.getRepositories?.() || null;
  } catch (_) {
    return null;
  }
}

function isRelational(services) {
  try {
    return Boolean(services.storageManager?.isPostgresEnabled?.());
  } catch (_) {
    return false;
  }
}

function countAiosUserData(services) {
  const users = services.getUsersSnapshot?.() || {};
  const values = Object.values(users || {});
  return values.reduce((acc, user) => {
    const aios = user.aios || {};
    acc.totalUsers += 1;
    acc.memoryCount += Array.isArray(aios.memories) ? aios.memories.length : 0;
    acc.goalCount += Array.isArray(aios.goals) ? aios.goals.length : 0;
    acc.workflowCount += Array.isArray(aios.workflows) ? aios.workflows.length : 0;
    acc.insightCount += Array.isArray(aios.insights) ? aios.insights.length : 0;
    acc.graphNodeCount += Array.isArray(aios.graph?.nodes) ? aios.graph.nodes.length : 0;
    acc.graphEdgeCount += Array.isArray(aios.graph?.edges) ? aios.graph.edges.length : 0;
    return acc;
  }, {
    totalUsers: 0,
    memoryCount: 0,
    goalCount: 0,
    workflowCount: 0,
    insightCount: 0,
    graphNodeCount: 0,
    graphEdgeCount: 0
  });
}

async function listMemories(userId, query, options, services) {
  const repos = getRepositories(services);
  let items = [];
  if (isRelational(services) && repos?.memories) {
    items = query
      ? repos.memories.searchMemories(userId, query, options)
      : repos.memories.listMemories(userId, options);
    items = await items;
    return filterByWorkspace(items, userId, options.workspaceId);
  }
  items = services.aiOS.unifiedMemory?.listMemories
    ? services.aiOS.unifiedMemory.listMemories(userId, options, getAiosServices(services))
    : [];
  return filterByWorkspace(await items, userId, options.workspaceId);
}

async function listGoals(userId, services, options = {}) {
  const repos = getRepositories(services);
  let items = [];
  if (isRelational(services) && repos?.goals) {
    items = await repos.goals.listGoals(userId, { limit: 100 });
    return filterByWorkspace(items, userId, options.workspaceId);
  }
  items = services.aiOS.goalManager?.listGoals
    ? services.aiOS.goalManager.listGoals(userId, {}, getAiosServices(services))
    : [];
  return filterByWorkspace(await items, userId, options.workspaceId);
}

async function listWorkflows(userId, services, options = {}) {
  const repos = getRepositories(services);
  let items = [];
  if (isRelational(services) && repos?.workflows) {
    const workflows = await repos.workflows.listWorkflows(userId, { limit: 100 });
    const enriched = [];
    for (const workflow of workflows) {
      const steps = repos.workflows.listWorkflowSteps
        ? await safeCall(() => repos.workflows.listWorkflowSteps(userId, workflow.id), [])
        : [];
      enriched.push({ ...workflow, steps });
    }
    return filterByWorkspace(enriched, userId, options.workspaceId);
  }
  items = services.aiOS.workflowEngine?.listActiveWorkflows
    ? services.aiOS.workflowEngine.listActiveWorkflows(userId, getAiosServices(services), 100)
    : [];
  return filterByWorkspace(await items, userId, options.workspaceId);
}

async function listInsights(userId, services, limit = 20) {
  const repos = getRepositories(services);
  if (isRelational(services) && repos?.insights) return repos.insights.listInsights(userId, { limit });
  return services.aiOS.insightStore?.listInsights
    ? services.aiOS.insightStore.listInsights(userId, { limit }, getAiosServices(services))
    : [];
}

async function getGraphSnapshot(userId, services, options = {}) {
  const repos = getRepositories(services);
  if (isRelational(services) && repos?.graph) {
    const snapshot = await repos.graph.getGraphSnapshot(userId, { nodeLimit: options.nodeLimit || 20, edgeLimit: options.edgeLimit || 40 });
    return {
      nodes: filterByWorkspace(snapshot.nodes || [], userId, options.workspaceId),
      edges: filterByWorkspace(snapshot.edges || [], userId, options.workspaceId),
      stats: {
        nodes: snapshot.nodes?.length || 0,
        edges: snapshot.edges?.length || 0
      }
    };
  }
  const aiosServices = getAiosServices(services);
  await services.aiOS.knowledgeGraph?.hydrateGraphFromStorage?.(userId, aiosServices);
  const stats = services.aiOS.knowledgeGraph?.getGraphStats?.(userId, aiosServices) || {};
  const snapshot = services.aiOS.knowledgeGraph?.buildGraphSnapshot?.(userId, {
    nodeLimit: options.nodeLimit || 20,
    edgeLimit: options.edgeLimit || 40
  }, aiosServices) || { nodes: [], edges: [] };
  return { ...snapshot, nodes: filterByWorkspace(snapshot.nodes || [], userId, options.workspaceId), edges: filterByWorkspace(snapshot.edges || [], userId, options.workspaceId), stats };
}

function ensureUserState(userId, services) {
  if (typeof services.ensureUser !== 'function') return {};
  return services.ensureUser(userId) || {};
}

function getOpsRuntimeServices(services, rawServices = {}) {
  return typeof services.getOpsServices === 'function' ? services.getOpsServices() : rawServices;
}

function setDashboardSecurityHeaders(res) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });
}

function buildActionContext(req, services = {}) {
  return {
    actorId: req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || 'dashboard-admin',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || '',
    permission: req.dashboardPermission || permissions.getDashboardPermissionLevel(req)
  };
}

async function runSafeAction(actionName, req, res, services) {
  const result = await safeActions.handleSafeAction(actionName, req.body || {}, buildActionContext(req, services), services);
  return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status === 'rejected' ? 400 : 404));
}

function registerDashboardRoutes(app, rawServices = {}) {
  const services = getDashboardServices(rawServices);
  const router = express.Router();
  const dashboardAuth = auth.createDashboardAuth(services.env);
  const dashboardDir = path.join(process.cwd(), 'public', 'dashboard');

  app.locals.dashboardEnv = services.env;

  app.use('/dashboard', (req, res, next) => {
    setDashboardSecurityHeaders(res);
    next();
  });

  app.get(['/dashboard', '/dashboard/'], (req, res) => {
    res.sendFile(path.join(dashboardDir, 'index.html'));
  });

  pwaRoutes.registerPwaStaticRoutes(app, dashboardDir);

  app.use('/dashboard', express.static(dashboardDir, {
    index: false,
    fallthrough: true,
    extensions: false,
    setHeaders: setDashboardSecurityHeaders
  }));

  router.get('/health', (req, res) => {
    const storage = getStorageStatus(services.storageManager);
    const dashboardStatus = auth.getDashboardStatus(services.env);
    return guards.safeDashboardResponse(res, serializers.sanitizeHealth(buildDashboardHealthPayload(storage, dashboardStatus)));
  });

  // Authenticate other API routes
  router.use(dashboardAuth);
  workspaceRoutes.registerWorkspaceRoutes(router, services);
  plannerRoutes.registerPlannerRoutes(router, services);
  executorRoutes.registerExecutorRoutes(router, services);
  toolRoutes.registerToolRoutes(router, services);
  backupRoutes.registerBackupRoutes(router, services);
  pwaRoutes.registerPwaApiRoutes(router, services);
  agentMemoryRoutes.registerAgentMemoryRoutes(router, services);
  councilRoutes.registerCouncilRoutes(router, services);
  agentRoutes.registerAgentRoutes(router, services);
  agentTaskRoutes.registerAgentTaskRoutes(router, services);
  decisionRoutes.registerDecisionRoutes(router, services);
  agentExecutorRoutes.registerAgentExecutorRoutes(router, services);
  agentEvaluationRoutes.registerAgentEvaluationRoutes(router, services);
  integrationExecutionRoutes.registerIntegrationExecutionRoutes(router, services);
  try {
    observabilityRoutes.registerObservabilityRoutes(router, services);
  } catch (e) {
    const log = services.logger || console;
    log.warn('[dashboard] Observability routes skipped:', e.message);
  }
  if (services.selfHealingSystem) {
    selfhealingRoutes.registerSelfHealingRoutes(router, services);
  }
  if (services.monitoringSystem) {
    monitoringRoutes.registerMonitoringRoutes(router, services);
  }
  if (services.cicdSystem) {
    cicdRoutes.registerCicdRoutes(router, services);
  }

  routineRoutes.registerRoutineDashboardRoutes(app, services);

  try {
    const devGovRoutes = require('./devgovernance-routes');
    devGovRoutes.registerDevGovernanceRoutes(router, services);
  } catch (e) {
    const log = services.logger || console;
    log.warn('[dashboard] DevGovernance routes skipped:', e.message);
  }

  try {
    const githubOpsRoutes = require('./githubops-routes');
    githubOpsRoutes.registerGithubOpsRoutes(router, services);
  } catch (e) {
    const log = services.logger || console;
    log.warn('[dashboard] GithubOps routes skipped:', e.message);
  }

  try {
    const deployRoutes = require('./deploy-routes');
    deployRoutes.registerDeployRoutes(router, services);
  } catch (e) {
    const log = services.logger || console;
    log.warn('[dashboard] Deploy routes skipped:', e.message);
  }

  try {
    costRoutes.registerCostRoutes(router, services);
  } catch (e) {
    const log = services.logger || console;
    log.warn('[dashboard] Cost routes skipped:', e.message);
  }

  try {
    knowledgeRoutes.registerKnowledgeRoutes(router, services);
  } catch (e) {
    const log = services.logger || console;
    log.warn('[dashboard] Knowledge routes skipped:', e.message);
  }

  router.get('/summary', async (req, res) => {
    const storageStatus = getStorageStatus(services.storageManager);
    const counts = countAiosUserData(services);
    let opsStatus = null;
    try {
      opsStatus = services.opsSystem?.getStatus?.(getOpsRuntimeServices(services, rawServices)) || null;
    } catch (err) {
      opsStatus = { status: 'unavailable', error: err.message };
    }
    return guards.safeDashboardResponse(res, serializers.sanitizeDashboardSummary({
      ...counts,
      storageStatus,
      opsStatus
    }));
  });

  router.get('/storage', async (req, res) => {
    if (services.storageManager?.refreshStorageHealth) {
      await safeCall(() => services.storageManager.refreshStorageHealth({ force: true }), null);
    }
    const storageStatus = getStorageStatus(services.storageManager);
    return guards.safeDashboardResponse(res, serializers.sanitizeStorage(storageStatus));
  });

  router.get('/user/:userId/overview', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const user = ensureUserState(userId, services);
    const aiosServices = getAiosServices(services);
    const memories = await safeCall(() => listMemories(userId, '', { limit: 20, workspaceId: access.workspaceId }, services), []);
    const goals = await safeCall(() => listGoals(userId, services, { workspaceId: access.workspaceId }), []);
    const workflows = await safeCall(() => listWorkflows(userId, services, { workspaceId: access.workspaceId }), []);
    const insights = await safeCall(() => listInsights(userId, services, 10), []);
    const graph = await safeCall(() => getGraphSnapshot(userId, services, { nodeLimit: 12, edgeLimit: 20, workspaceId: access.workspaceId }), { nodes: [], edges: [], stats: {} });
    const memoryStats = services.aiOS.unifiedMemory?.getMemoryStats?.(userId, aiosServices) || { total: memories.length };
    
    return guards.safeDashboardResponse(res, serializers.sanitizeUserOverview({
      workspaceId: access.workspaceId,
      actorRole: access.role,
      memoryStats,
      activeGoals: goals.filter(goal => !goal.status || goal.status === 'active'),
      activeWorkflows: workflows.filter(workflow => !workflow.status || workflow.status === 'active'),
      recentInsights: insights,
      graphStats: graph.stats || {},
      adaptiveProfileSummary: {
        enabled: user.adaptive?.enabled !== false,
        activeMode: user.adaptive?.activeMode || null,
        lastReason: user.adaptive?.lastReason || '',
        lastConfidence: Number(user.adaptive?.lastConfidence || 0)
      }
    }));
  });

  router.get('/user/:userId/memories', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const limit = guards.validateLimit(req.query.limit, 20, 100);
    const q = String(req.query.q || '');
    const type = req.query.type ? String(req.query.type) : undefined;
    const memories = await safeCall(() => listMemories(userId, q, { limit, type, workspaceId: access.workspaceId }, services), []);
    return guards.safeDashboardResponse(res, { workspaceId: access.workspaceId, items: memories.map(serializers.sanitizeMemory), limit });
  });

  router.get('/user/:userId/goals', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const goals = await safeCall(() => listGoals(userId, services, { workspaceId: access.workspaceId }), []);
    return guards.safeDashboardResponse(res, { workspaceId: access.workspaceId, items: goals.map(serializers.sanitizeGoal) });
  });

  router.get('/user/:userId/workflows', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const workflows = await safeCall(() => listWorkflows(userId, services, { workspaceId: access.workspaceId }), []);
    return guards.safeDashboardResponse(res, { workspaceId: access.workspaceId, items: workflows.map(serializers.sanitizeWorkflow) });
  });

  router.get('/user/:userId/insights', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const limit = guards.validateLimit(req.query.limit, 20, 100);
    const insights = await safeCall(() => listInsights(userId, services, limit), []);
    return guards.safeDashboardResponse(res, { workspaceId: access.workspaceId, items: filterByWorkspace(insights, userId, access.workspaceId).map(serializers.sanitizeInsight), limit });
  });

  router.get('/user/:userId/graph', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const graph = await safeCall(() => getGraphSnapshot(userId, services, { nodeLimit: 20, edgeLimit: 40, workspaceId: access.workspaceId }), { nodes: [], edges: [], stats: {} });
    return guards.safeDashboardResponse(res, serializers.sanitizeGraph({
      stats: graph.stats || {},
      summaryText: graph.summaryText || '',
      topNodes: graph.nodes || [],
      topEdges: graph.edges || []
    }));
  });

  router.get('/user/:userId/graph/search', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const access = await ensureDashboardUserAccess(req, res, services, userId, 'read');
    if (!access.ok) return access.response;
    const q = String(req.query.q || '').trim();
    const aiosServices = getAiosServices(services);
    const result = services.aiOS.graphRetriever?.getRelevantGraph?.(userId, q, { nodeLimit: 8, edgeLimit: 12 }, aiosServices) || { nodes: [], edges: [], summaryText: '' };
    return guards.safeDashboardResponse(res, {
      query: q,
      workspaceId: access.workspaceId,
      nodes: filterByWorkspace(result.nodes || [], userId, access.workspaceId).map(serializers.sanitizeGraphNode),
      edges: filterByWorkspace(result.edges || [], userId, access.workspaceId).map(serializers.sanitizeGraphEdge),
      summaryText: serializers.truncateText(result.summaryText || '', 1200)
    });
  });

  router.get('/ops', async (req, res) => {
    const opsServices = getOpsRuntimeServices(services, rawServices);
    let ops = null;
    let performance = null;
    let incidents = [];
    let benchmark = null;
    try {
      ops = services.opsSystem?.getStatus?.(opsServices) || null;
      performance = services.opsSystem?.performanceProfiler?.summarizePerformance?.(opsServices) || null;
      incidents = services.opsSystem?.incidentHandler?.listRecentIncidents?.(opsServices, 8) || [];
      benchmark = services.opsSystem?.benchmarkEngine?.getBenchmarkSummary?.(opsServices) || null;
    } catch (err) {
      ops = { status: 'unavailable', error: err.message };
    }
    return guards.safeDashboardResponse(res, serializers.sanitizeOps({
      ...(ops || {}),
      performance,
      recentIncidents: incidents,
      benchmarkSummary: benchmark
    }));
  });

  router.get('/reliability', async (req, res) => {
    try {
      const scoreObj = services.opsSystem?.reliabilityScorer?.calculateReliabilityScore?.(getOpsRuntimeServices(services, rawServices)) || { score: 0, status: 'unknown' };
      return guards.safeDashboardResponse(res, serializers.sanitizeReliability(scoreObj));
    } catch (err) {
      return guards.safeDashboardResponse(res, { score: 0, status: 'unavailable', error: err.message });
    }
  });

  router.get('/benchmarks', async (req, res) => {
    const opsServices = getOpsRuntimeServices(services, rawServices);
    try {
      const history = services.opsSystem?.benchmarkEngine?.getBenchmarkHistory?.(opsServices, 20) || [];
      const summary = services.opsSystem?.benchmarkEngine?.getBenchmarkSummary?.(opsServices) || { totalRuns: 0 };
      return guards.safeDashboardResponse(res, {
        summary,
        history: history.map(serializers.sanitizeBenchmark)
      });
    } catch (err) {
      return guards.safeDashboardResponse(res, { history: [], summary: {}, error: err.message });
    }
  });

  router.get('/incidents', async (req, res) => {
    const opsServices = getOpsRuntimeServices(services, rawServices);
    try {
      const incidents = services.opsSystem?.incidentHandler?.listIncidents?.(opsServices, { limit: 20 })
        || services.opsSystem?.incidentHandler?.listRecentIncidents?.(opsServices, 20)
        || [];
      return guards.safeDashboardResponse(res, {
        items: incidents.map(serializers.sanitizeIncident)
      });
    } catch (err) {
      return guards.safeDashboardResponse(res, { items: [], error: err.message });
    }
  });

  router.get('/commands', (req, res) => {
    return guards.safeDashboardResponse(res, serializers.sanitizeCommandList(utils.buildCommandCatalog()));
  });

  router.get('/env-check', (req, res) => {
    return guards.safeDashboardResponse(res, serializers.sanitizeEnvStatus(services.env));
  });

  router.get('/audit', async (req, res) => {
    const options = {
      limit: req.query.limit,
      action: req.query.action,
      status: req.query.status,
      targetType: req.query.targetType,
      userId: req.query.userId,
      workspaceId: req.query.workspaceId,
      decision: req.query.decision
    };
    const items = await auditLog.listAuditLogs(options, services);
    const summary = await auditLog.getAuditSummary({ limit: 5 }, services);
    return guards.safeDashboardResponse(res, { items, summary });
  });

  // Protected Safe Admin Actions API with Rate Limit
  router.post('/actions/diagnostics/run', guards.rateLimitDashboardAction, permissions.requireActionPermission('diagnostics/run'), async (req, res) => {
    const result = await actions.handleAction('diagnostics/run', services, req.body || {});
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/benchmark/run-light', guards.rateLimitDashboardAction, permissions.requireActionPermission('benchmark/run-light'), async (req, res) => {
    const result = await actions.handleAction('benchmark/run-light', services, req.body || {});
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/telemetry/prune', guards.rateLimitDashboardAction, permissions.requireActionPermission('telemetry/prune'), async (req, res) => {
    const result = await actions.handleAction('telemetry/prune', services, req.body || {});
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/ops/refresh', guards.rateLimitDashboardAction, permissions.requireActionPermission('ops/refresh'), async (req, res) => {
    const result = await actions.handleAction('ops/refresh', services, req.body || {});
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/report/export-health', guards.rateLimitDashboardAction, permissions.requireActionPermission('report/export-health'), async (req, res) => {
    const result = await actions.handleAction('report/export-health', services, req.body || {});
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/report/export-user-summary', guards.rateLimitDashboardAction, permissions.requireActionPermission('report/export-user-summary'), async (req, res) => {
    const result = await actions.handleAction('report/export-user-summary', services, req.body || {});
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/memory/update', guards.rateLimitDashboardAction, permissions.requireActionPermission('memory/update'), async (req, res) => {
    return runSafeAction('memory/update', req, res, services);
  });

  router.post('/actions/memory/archive', guards.rateLimitDashboardAction, permissions.requireActionPermission('memory/archive'), async (req, res) => {
    return runSafeAction('memory/archive', req, res, services);
  });

  router.post('/actions/memory/restore', guards.rateLimitDashboardAction, permissions.requireActionPermission('memory/restore'), async (req, res) => {
    return runSafeAction('memory/restore', req, res, services);
  });

  router.post('/actions/goal/update', guards.rateLimitDashboardAction, permissions.requireActionPermission('goal/update'), async (req, res) => {
    return runSafeAction('goal/update', req, res, services);
  });

  router.post('/actions/goal/archive', guards.rateLimitDashboardAction, permissions.requireActionPermission('goal/archive'), async (req, res) => {
    return runSafeAction('goal/archive', req, res, services);
  });

  router.post('/actions/goal/restore', guards.rateLimitDashboardAction, permissions.requireActionPermission('goal/restore'), async (req, res) => {
    return runSafeAction('goal/restore', req, res, services);
  });

  router.post('/actions/workflow/step/add', guards.rateLimitDashboardAction, permissions.requireActionPermission('workflow/step/add'), async (req, res) => {
    return runSafeAction('workflow/step/add', req, res, services);
  });

  router.post('/actions/workflow/step/done', guards.rateLimitDashboardAction, permissions.requireActionPermission('workflow/step/done'), async (req, res) => {
    return runSafeAction('workflow/step/done', req, res, services);
  });

  router.post('/actions/workflow/step/reorder', guards.rateLimitDashboardAction, permissions.requireActionPermission('workflow/step/reorder'), async (req, res) => {
    return runSafeAction('workflow/step/reorder', req, res, services);
  });

  router.post('/actions/workflow/archive', guards.rateLimitDashboardAction, permissions.requireActionPermission('workflow/archive'), async (req, res) => {
    return runSafeAction('workflow/archive', req, res, services);
  });

  router.post('/actions/workflow/restore', guards.rateLimitDashboardAction, permissions.requireActionPermission('workflow/restore'), async (req, res) => {
    return runSafeAction('workflow/restore', req, res, services);
  });

  app.use('/api/dashboard', router);
  return router;
}

module.exports = {
  registerDashboardRoutes,
  get registerCodingWorkspaceRoutes() {
    return require('./coding-workspace-routes').registerCodingWorkspaceRoutes;
  }
};
