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
    steps: steps.slice(0, 30).map(step => ({
      id: step.id,
      stepNumber: step.stepNumber || step.step_number,
      title: truncateText(step.title || step.text || '', 180),
      status: step.status || (step.done ? 'done' : 'pending'),
      result: truncateText(step.result || '', 260),
      completedAt: step.completedAt || step.completed_at || null
    }))
  };
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
    createdAt: edge.createdAt || edge.created_at,
    updatedAt: edge.updatedAt || edge.updated_at
  };
}

function sanitizeOpsData(data = {}) {
  return guards.preventSecretLeak({
    health: data.health || data.status || null,
    telemetry: data.telemetry || null,
    incidents: Array.isArray(data.incidents) ? data.incidents.slice(0, 20) : data.incidents || null,
    reliability: data.reliability || null
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
    dashboardAdminToken: isSet(env.DASHBOARD_ADMIN_TOKEN)
  };
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
    storageStatus: data.storageStatus || null,
    opsStatus: data.opsStatus || null
  });
}

function sanitizeHealth(data = {}) {
  return guards.preventSecretLeak({
    ok: Boolean(data.ok),
    uptime: Number(data.uptime || 0),
    timestamp: data.timestamp || null,
    version: data.version || 'unknown',
    storageDriver: data.storageDriver || 'unknown',
    redisAvailable: Boolean(data.redisAvailable)
  });
}

function sanitizeOps(data = {}) {
  return sanitizeOpsData(data);
}

function sanitizeReliability(data = {}) {
  if (!data) return null;
  return guards.preventSecretLeak({
    score: Number(data.score ?? 0),
    status: data.status || 'unknown',
    lastUpdated: data.lastUpdated || null
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

module.exports = {
  sanitizeEnvStatus,
  sanitizeGoal,
  sanitizeGraphEdge,
  sanitizeGraphNode,
  sanitizeInsight,
  sanitizeMemory,
  sanitizeOpsData,
  sanitizeWorkflow,
  truncateText,
  sanitizeDashboardSummary,
  sanitizeHealth,
  sanitizeOps,
  sanitizeReliability,
  sanitizeBenchmark,
  sanitizeIncident,
  sanitizeCommandList,
  sanitizeUserOverview,
  sanitizeGraph
};
