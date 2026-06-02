'use strict';

const {
  clampScore,
  compactMemory,
  containsSecretLike,
  getUserIdFromContext,
  getWorkspaceIdFromContext,
  isArchived,
  normalizeAgentId,
  normalizeWorkspaceId,
  sanitizeMemoryText,
  unique
} = require('./agent-memory-utils');
const topicClassifier = require('./topic-classifier');

const AGENT_TOPIC_FIT = {
  orchestrator: ['unknown', 'casual', 'planning', 'roadmap', 'dashboard', 'telegram', 'school_life', 'social_advice', 'emotional_support', 'daily_life'],
  planner: ['planning', 'roadmap', 'learning', 'project', 'workflow'],
  coder: ['coding', 'debugging', 'database', 'redis', 'telegram', 'deploy'],
  critic: ['security', 'risk', 'roadmap', 'planning', 'backup'],
  research: ['research', 'search', 'learning'],
  ops: ['ops', 'deploy', 'database', 'redis', 'backup', 'export', 'import', 'restore'],
  security: ['security', 'secret', 'restore', 'import', 'executor', 'tool'],
  memory: ['memory', 'graph', 'project', 'dashboard'],
  executor: ['executor', 'tool', 'backup', 'restore'],
  reflection: ['emotional', 'personal_reflection', 'emotional_support', 'social_advice', 'school_life', 'daily_life', 'learning']
};

const TYPE_TOPIC_FIT = {
  technical_pattern: ['coding', 'debugging', 'database', 'redis', 'telegram', 'deploy'],
  project_context: ['planning', 'roadmap', 'project', 'coding', 'deploy', 'dashboard'],
  risk_pattern: ['security', 'risk', 'restore', 'import', 'backup', 'roadmap'],
  learning_note: ['learning', 'research', 'personal_reflection', 'school_life'],
  decision_note: ['planning', 'roadmap', 'database', 'backup', 'executor'],
  ops_note: ['ops', 'deploy', 'database', 'redis', 'backup'],
  security_note: ['security', 'secret', 'restore', 'import', 'executor'],
  reflection_note: ['emotional', 'personal_reflection', 'emotional_support', 'social_advice', 'school_life', 'daily_life', 'learning'],
  user_preference: ['casual', 'unknown', 'learning', 'personal_reflection', 'school_life', 'social_advice', 'daily_life'],
  shared_context: ['planning', 'project', 'coding', 'dashboard', 'memory', 'graph'],
  correction: ['coding', 'debugging', 'planning'],
  lesson: ['learning', 'coding', 'planning', 'ops']
};

function tokenize(text = '') {
  return unique(String(text || '').toLowerCase().match(/[a-z0-9_+#.-]{3,}|[a-z\u00c0-\u024f]{4,}/gi) || [])
    .map(token => token.toLowerCase())
    .filter(token => !['yang', 'untuk', 'dari', 'dengan', 'saya', 'kamu', 'bot', 'dan', 'atau'].includes(token));
}

function inferTopics(message = '', context = {}, services = {}) {
  if (Array.isArray(context.topics) && context.topics.length) return context.topics;
  try {
    const result = topicClassifier.classifyMessageTopic(message, context, services);
    return Array.isArray(result) ? result : (result.topics || ['unknown']);
  } catch (_) {
    return ['unknown'];
  }
}

function calculateMemoryRelevance(memory = {}, message = '', context = {}, services = {}) {
  const topics = inferTopics(message, context, services);
  const agentId = normalizeAgentId(context.agentId || memory.agentId);
  const messageTokens = tokenize(message);
  const memoryTokens = tokenize(`${memory.title || ''} ${memory.content || ''} ${(memory.tags || []).join(' ')}`);
  const overlap = messageTokens.filter(token => memoryTokens.includes(token)).length;
  let score = 0;

  if (memory.agentId === agentId) score += 0.18;
  if (memory.agentId === 'shared' || memory.type === 'shared_context') score += 0.12;
  score += Math.min(overlap * 0.08, 0.34);
  score += clampScore(memory.importance, 0.5) * 0.18;
  score += clampScore(memory.confidence, 0.5) * 0.12;
  if (Number(memory.usageCount || 0) > 0) score += 0.04;

  const agentFit = AGENT_TOPIC_FIT[agentId] || [];
  if (topics.some(topic => agentFit.includes(topic))) score += 0.12;
  const typeFit = TYPE_TOPIC_FIT[memory.type] || [];
  if (topics.some(topic => typeFit.includes(topic))) score += 0.16;
  const personalDomain = topicClassifier.isPersonalDomainMessage?.(message, topics);
  if (personalDomain && !['reflection', 'orchestrator'].includes(agentId)) score -= 0.34;
  if (personalDomain && ['technical_pattern', 'project_context', 'ops_note', 'security_note', 'decision_note', 'shared_context'].includes(memory.type)) score -= 0.42;
  if (personalDomain && ['reflection_note', 'user_preference', 'learning_note'].includes(memory.type)) score += 0.18;
  if (topics.includes('emotional') && !['reflection', 'orchestrator'].includes(agentId) && !['reflection_note', 'user_preference'].includes(memory.type)) score -= 0.28;
  if ((topics.includes('secret') || topics.includes('security')) && !['security', 'orchestrator'].includes(agentId) && memory.type !== 'security_note') score -= 0.18;
  if ((topics.includes('executor') || topics.includes('restore')) && !['executor', 'security', 'orchestrator', 'ops'].includes(agentId)) score -= 0.18;

  return clampScore(score, 0);
}

function preventMemoryLeakageAcrossDomains(memory = {}, context = {}) {
  const workspaceId = getWorkspaceIdFromContext(context);
  const userId = getUserIdFromContext(context);
  if (isArchived(memory)) return { ok: false, reason: 'archived' };
  if (containsSecretLike(memory)) return { ok: false, reason: 'secret_like_content' };
  if (memory.workspaceId && normalizeWorkspaceId(memory.workspaceId) !== workspaceId) return { ok: false, reason: 'workspace_mismatch' };
  if (memory.userId && userId && String(memory.userId) !== String(userId) && memory.type !== 'shared_context') {
    return { ok: false, reason: 'user_mismatch' };
  }
  return { ok: true, reason: 'allowed' };
}

function filterRelevantMemories(memories = [], message = '', agent = {}, context = {}, services = {}) {
  const agentId = normalizeAgentId(agent.id || context.agentId || 'orchestrator');
  const maxItems = Math.min(Math.max(Number(context.maxAgentMemories || agent.memoryPolicy?.maxAgentMemories || 5), 1), 5);
  return (memories || [])
    .map(memory => ({ ...memory, relevanceScore: calculateMemoryRelevance(memory, message, { ...context, agentId }, services) }))
    .filter(memory => preventMemoryLeakageAcrossDomains(memory, context).ok)
    .filter(memory => memory.relevanceScore >= Number(context.minRelevanceScore || 0.18))
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      if (Number(b.importance || 0) !== Number(a.importance || 0)) return Number(b.importance || 0) - Number(a.importance || 0);
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    })
    .slice(0, maxItems)
    .map(memory => compactMemory(memory, 420));
}

function scoreSharedMemory(memory = {}, message = '', context = {}, services = {}) {
  return calculateMemoryRelevance({ ...memory, agentId: 'shared', type: memory.type || 'shared_context' }, message, context, services);
}

function buildMemoryUseExplanation(memories = [], message = '') {
  const used = memories.length;
  if (!used) return 'Tidak ada agent memory relevan yang dipakai.';
  const labels = memories.slice(0, 5).map(memory => `${sanitizeMemoryText(memory.title, 80)} (${Math.round(Number(memory.relevanceScore || 0) * 100)}%)`);
  return `Memakai ${used} memory relevan untuk "${sanitizeMemoryText(message, 80)}": ${labels.join(', ')}.`;
}

module.exports = {
  calculateMemoryRelevance,
  filterRelevantMemories,
  preventMemoryLeakageAcrossDomains,
  buildMemoryUseExplanation,
  scoreSharedMemory,
  tokenize
};
