'use strict';

const VALID_SOURCES = [
  'natural_chat', 'agent_router', 'council', 'delegation', 'decision',
  'executor', 'evaluation', 'integration', 'coding_workspace', 'routine',
  'observability', 'incident_response'
];

const SECRET_PATTERNS = [
  /token\s*[:=]\s*\S+/gi, /secret\s*[:=]\s*\S+/gi, /password\s*[:=]\s*\S+/gi,
  /api_key\s*[:=]\s*\S+/gi, /Authorization\s*[:=]\s*\S+/gi, /Bearer\s+\S+/gi,
  /DATABASE_URL\s*[:=]\s*\S+/gi, /REDIS_URL\s*[:=]\s*\S+/gi,
  /sk-\S+/g, /ghp_\S+/g, /github_pat_\S+/g, /gsk_\S+/g, /tvly_\S+/g,
  /TELEGRAM_TOKEN\s*[:=]\s*\S+/gi, /GITHUB_TOKEN\s*[:=]\s*\S+/gi,
  /GOOGLE_CLIENT_SECRET\s*[:=]\s*\S+/gi, /CLOUDFLARE_API_TOKEN\s*[:=]\s*\S+/gi,
  /RENDER_DEPLOY_HOOK\s*[:=]\s*\S+/gi, /postgresql:\/\/\S+/gi, /rediss:\/\/\S+/gi
];

let usageEvents = [];
let idCounter = 1;

function redactSecrets(text) {
  if (!text) return text;
  let result = String(text);
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function isValidSource(source) {
  return VALID_SOURCES.includes(source);
}

function generateId() {
  return 'cost_' + Date.now() + '_' + (idCounter++);
}

function recordModelUsage(event, services) {
  const id = event.id || generateId();
  const source = event.source || 'natural_chat';
  const usage = {
    id,
    workspaceId: event.workspaceId || 'default',
    userId: event.userId || 'unknown',
    chatId: event.chatId || '',
    source: isValidSource(source) ? source : 'natural_chat',
    agentId: event.agentId || '',
    model: event.model || 'unknown',
    provider: event.provider || 'unknown',
    inputTokens: typeof event.inputTokens === 'number' ? event.inputTokens : 0,
    outputTokens: typeof event.outputTokens === 'number' ? event.outputTokens : 0,
    totalTokens: typeof event.totalTokens === 'number' ? event.totalTokens : ((event.inputTokens || 0) + (event.outputTokens || 0)),
    estimatedCost: typeof event.estimatedCost === 'number' ? event.estimatedCost : 0,
    actualCost: typeof event.actualCost === 'number' ? event.actualCost : null,
    mode: event.mode || 'unknown',
    requestType: event.requestType || 'unknown',
    metadata: event.metadata ? redactMetadata(event.metadata) : {},
    estimated: event.estimated !== false,
    createdAt: event.createdAt || new Date().toISOString()
  };
  usageEvents.push(usage);
  return usage;
}

function redactMetadata(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const safe = {};
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'string') {
      safe[key] = redactSecrets(value);
    } else if (typeof value === 'object' && value !== null) {
      safe[key] = redactMetadata(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function recordEstimatedUsage(event, services) {
  return recordModelUsage({ ...event, estimated: true, estimatedCost: event.estimatedCost || 0 }, services);
}

function listUsageEvents(filters, services) {
  let result = [...usageEvents];
  if (filters) {
    if (filters.workspaceId) result = result.filter(e => e.workspaceId === filters.workspaceId);
    if (filters.userId) result = result.filter(e => e.userId === filters.userId);
    if (filters.source) result = result.filter(e => e.source === filters.source);
    if (filters.agentId) result = result.filter(e => e.agentId === filters.agentId);
    if (filters.model) result = result.filter(e => e.model === filters.model);
    if (filters.provider) result = result.filter(e => e.provider === filters.provider);
    if (filters.startDate) result = result.filter(e => new Date(e.createdAt) >= new Date(filters.startDate));
    if (filters.endDate) result = result.filter(e => new Date(e.createdAt) <= new Date(filters.endDate));
    if (filters.limit) result = result.slice(0, filters.limit);
  }
  return result;
}

function getUsageSummary(filters, services) {
  const events = listUsageEvents(filters, services);
  const summary = {
    totalEvents: events.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    bySource: {},
    byModel: {},
    byProvider: {},
    byAgent: {}
  };
  for (const e of events) {
    summary.totalInputTokens += e.inputTokens || 0;
    summary.totalOutputTokens += e.outputTokens || 0;
    summary.totalTokens += e.totalTokens || 0;
    summary.totalEstimatedCost += e.estimatedCost || 0;
    summary.totalActualCost += e.actualCost || 0;
    if (!summary.bySource[e.source]) summary.bySource[e.source] = { count: 0, tokens: 0, cost: 0 };
    summary.bySource[e.source].count++;
    summary.bySource[e.source].tokens += e.totalTokens || 0;
    summary.bySource[e.source].cost += e.estimatedCost || 0;
    if (!summary.byModel[e.model]) summary.byModel[e.model] = { count: 0, tokens: 0, cost: 0 };
    summary.byModel[e.model].count++;
    summary.byModel[e.model].tokens += e.totalTokens || 0;
    summary.byModel[e.model].cost += e.estimatedCost || 0;
    if (!summary.byProvider[e.provider]) summary.byProvider[e.provider] = { count: 0, tokens: 0, cost: 0 };
    summary.byProvider[e.provider].count++;
    summary.byProvider[e.provider].tokens += e.totalTokens || 0;
    summary.byProvider[e.provider].cost += e.estimatedCost || 0;
    if (!summary.byAgent[e.agentId]) summary.byAgent[e.agentId] = { count: 0, tokens: 0, cost: 0 };
    summary.byAgent[e.agentId].count++;
    summary.byAgent[e.agentId].tokens += e.totalTokens || 0;
    summary.byAgent[e.agentId].cost += e.estimatedCost || 0;
  }
  return summary;
}

function deleteOldUsageEvents(policy, services) {
  const cutoff = new Date();
  if (policy.retentionDays) cutoff.setDate(cutoff.getDate() - policy.retentionDays);
  const before = usageEvents.length;
  usageEvents = usageEvents.filter(e => new Date(e.createdAt) >= cutoff);
  return { deleted: before - usageEvents.length, remaining: usageEvents.length };
}

function getEventsCount() {
  return usageEvents.length;
}

function clearEvents() {
  const count = usageEvents.length;
  usageEvents = [];
  return count;
}

module.exports = {
  recordModelUsage,
  recordEstimatedUsage,
  listUsageEvents,
  getUsageSummary,
  deleteOldUsageEvents,
  getEventsCount,
  clearEvents,
  VALID_SOURCES,
  redactSecrets
};
