'use strict';

const express = require('express');
const path = require('path');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const utils = require('./dashboard-utils');
const actions = require('./dashboard-actions');

function getDashboardServices(services = {}) {
  return {
    env: services.env || services.config || process.env,
    storageManager: services.storageManager || null,
    aiOS: services.aiOS || {},
    opsSystem: services.opsSystem || null,
    getOpsServices: services.getOpsServices,
    ensureUser: services.ensureUser,
    getUsersSnapshot: services.getUsersSnapshot,
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
  if (isRelational(services) && repos?.memories) {
    return query
      ? repos.memories.searchMemories(userId, query, options)
      : repos.memories.listMemories(userId, options);
  }
  return services.aiOS.unifiedMemory?.listMemories
    ? services.aiOS.unifiedMemory.listMemories(userId, options, getAiosServices(services))
    : [];
}

async function listGoals(userId, services) {
  const repos = getRepositories(services);
  if (isRelational(services) && repos?.goals) return repos.goals.listGoals(userId, { limit: 100 });
  return services.aiOS.goalManager?.listGoals
    ? services.aiOS.goalManager.listGoals(userId, {}, getAiosServices(services))
    : [];
}

async function listWorkflows(userId, services) {
  const repos = getRepositories(services);
  if (isRelational(services) && repos?.workflows) {
    const workflows = await repos.workflows.listWorkflows(userId, { limit: 100 });
    const enriched = [];
    for (const workflow of workflows) {
      const steps = repos.workflows.listWorkflowSteps
        ? await safeCall(() => repos.workflows.listWorkflowSteps(userId, workflow.id), [])
        : [];
      enriched.push({ ...workflow, steps });
    }
    return enriched;
  }
  return services.aiOS.workflowEngine?.listActiveWorkflows
    ? services.aiOS.workflowEngine.listActiveWorkflows(userId, getAiosServices(services), 100)
    : [];
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
      nodes: snapshot.nodes || [],
      edges: snapshot.edges || [],
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
  return { ...snapshot, stats };
}

function ensureUserState(userId, services) {
  if (typeof services.ensureUser !== 'function') return {};
  return services.ensureUser(userId) || {};
}

function registerDashboardRoutes(app, rawServices = {}) {
  const services = getDashboardServices(rawServices);
  const router = express.Router();
  const dashboardAuth = auth.createDashboardAuth(services.env);

  app.locals.dashboardEnv = services.env;

  // Serve public/dashboard/index.html on GET /dashboard
  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/dashboard/index.html'), {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer'
      }
    });
  });

  // Serve static assets from public/dashboard
  app.use('/dashboard', express.static(path.join(__dirname, '../../public/dashboard'), {
    setHeaders: (res) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer'
      });
    }
  }));

  router.get('/health', (req, res) => {
    const storage = getStorageStatus(services.storageManager);
    const dashboardStatus = auth.getDashboardStatus(services.env);
    return res.json({
      ok: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: utils.getVersion(),
      storageDriver: storage.driver || storage.persistentType || 'unknown',
      redisAvailable: Boolean(storage.redisAvailable || storage.cache?.redisAvailable),
      dashboardEnabled: dashboardStatus.enabled,
      adminTokenSet: dashboardStatus.adminTokenSet
    });
  });

  // Authenticate other API routes
  router.use(dashboardAuth);

  router.get('/summary', async (req, res) => {
    const storageStatus = getStorageStatus(services.storageManager);
    const counts = countAiosUserData(services);
    let opsStatus = null;
    try {
      opsStatus = services.opsSystem?.getStatus?.(typeof services.getOpsServices === 'function' ? services.getOpsServices() : rawServices) || null;
    } catch (err) {
      opsStatus = { status: 'unavailable', error: err.message };
    }
    return guards.safeDashboardResponse(res, serializers.sanitizeDashboardSummary({
      ...counts,
      storageStatus,
      opsStatus
    }));
  });

  router.get('/user/:userId/overview', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const user = ensureUserState(userId, services);
    const aiosServices = getAiosServices(services);
    const memories = await safeCall(() => listMemories(userId, '', { limit: 20 }, services), []);
    const goals = await safeCall(() => listGoals(userId, services), []);
    const workflows = await safeCall(() => listWorkflows(userId, services), []);
    const insights = await safeCall(() => listInsights(userId, services, 10), []);
    const graph = await safeCall(() => getGraphSnapshot(userId, services, { nodeLimit: 12, edgeLimit: 20 }), { nodes: [], edges: [], stats: {} });
    const memoryStats = services.aiOS.unifiedMemory?.getMemoryStats?.(userId, aiosServices) || { total: memories.length };
    
    return guards.safeDashboardResponse(res, serializers.sanitizeUserOverview({
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
    const limit = guards.validateLimit(req.query.limit, 20, 100);
    const q = String(req.query.q || '');
    const type = req.query.type ? String(req.query.type) : undefined;
    const memories = await safeCall(() => listMemories(userId, q, { limit, type }, services), []);
    return guards.safeDashboardResponse(res, { items: memories.map(serializers.sanitizeMemory), limit });
  });

  router.get('/user/:userId/goals', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const goals = await safeCall(() => listGoals(userId, services), []);
    return guards.safeDashboardResponse(res, { items: goals.map(serializers.sanitizeGoal) });
  });

  router.get('/user/:userId/workflows', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const workflows = await safeCall(() => listWorkflows(userId, services), []);
    return guards.safeDashboardResponse(res, { items: workflows.map(serializers.sanitizeWorkflow) });
  });

  router.get('/user/:userId/insights', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const limit = guards.validateLimit(req.query.limit, 20, 100);
    const insights = await safeCall(() => listInsights(userId, services, limit), []);
    return guards.safeDashboardResponse(res, { items: insights.map(serializers.sanitizeInsight), limit });
  });

  router.get('/user/:userId/graph', async (req, res) => {
    const userId = guards.validateUserId(req.params.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const graph = await safeCall(() => getGraphSnapshot(userId, services, { nodeLimit: 20, edgeLimit: 40 }), { nodes: [], edges: [], stats: {} });
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
    const q = String(req.query.q || '').trim();
    const aiosServices = getAiosServices(services);
    const result = services.aiOS.graphRetriever?.getRelevantGraph?.(userId, q, { nodeLimit: 8, edgeLimit: 12 }, aiosServices) || { nodes: [], edges: [], summaryText: '' };
    return guards.safeDashboardResponse(res, {
      query: q,
      nodes: (result.nodes || []).map(serializers.sanitizeGraphNode),
      edges: (result.edges || []).map(serializers.sanitizeGraphEdge),
      summaryText: serializers.truncateText(result.summaryText || '', 1200)
    });
  });

  router.get('/ops', async (req, res) => {
    let ops = null;
    try {
      ops = services.opsSystem?.getStatus?.(typeof services.getOpsServices === 'function' ? services.getOpsServices() : rawServices) || null;
    } catch (err) {
      ops = { status: 'unavailable', error: err.message };
    }
    return guards.safeDashboardResponse(res, serializers.sanitizeOps(ops || {}));
  });

  router.get('/reliability', async (req, res) => {
    try {
      const scoreObj = services.opsSystem?.reliabilityScorer?.calculateReliabilityScore?.(services) || { score: 0, status: 'unknown' };
      return guards.safeDashboardResponse(res, serializers.sanitizeReliability(scoreObj));
    } catch (err) {
      return guards.safeDashboardResponse(res, { score: 0, status: 'unavailable', error: err.message });
    }
  });

  router.get('/benchmarks', async (req, res) => {
    try {
      const history = services.opsSystem?.benchmarkEngine?.getBenchmarkHistory?.({}, services) || [];
      const summary = services.opsSystem?.benchmarkEngine?.getBenchmarkSummary?.(services) || { totalRuns: 0 };
      return guards.safeDashboardResponse(res, {
        summary,
        history: history.map(serializers.sanitizeBenchmark)
      });
    } catch (err) {
      return guards.safeDashboardResponse(res, { history: [], summary: {}, error: err.message });
    }
  });

  router.get('/incidents', async (req, res) => {
    try {
      const incidents = services.opsSystem?.incidentHandler?.listIncidents?.(services) || [];
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

  // Protected Safe Admin Actions API with Rate Limit
  router.post('/actions/diagnostics/run', guards.rateLimitDashboardAction, async (req, res) => {
    const result = await actions.handleAction('diagnostics/run', services);
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/benchmark/run-light', guards.rateLimitDashboardAction, async (req, res) => {
    const result = await actions.handleAction('benchmark/run-light', services);
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/telemetry/prune', guards.rateLimitDashboardAction, async (req, res) => {
    const result = await actions.handleAction('telemetry/prune', services);
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/actions/ops/refresh', guards.rateLimitDashboardAction, async (req, res) => {
    const result = await actions.handleAction('ops/refresh', services);
    return guards.safeDashboardResponse(res, result);
  });

  app.use('/api/dashboard', router);
  return router;
}

module.exports = {
  registerDashboardRoutes
};
