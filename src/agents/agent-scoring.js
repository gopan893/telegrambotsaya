'use strict';

const agentRegistry = require('./agent-registry');
const { unique } = require('./agent-utils');

const TOPIC_AGENT_MAP = {
  coding: ['coder'],
  debugging: ['coder', 'ops'],
  planning: ['planner', 'critic'],
  roadmap: ['planner', 'critic'],
  research: ['research'],
  search: ['research'],
  security: ['security'],
  secret: ['security'],
  ops: ['ops'],
  deploy: ['ops', 'coder'],
  database: ['coder', 'ops'],
  redis: ['ops', 'coder'],
  backup: ['ops', 'executor', 'security'],
  restore: ['security', 'executor', 'ops'],
  import: ['security', 'executor'],
  export: ['ops'],
  executor: ['executor', 'security'],
  tool: ['executor', 'coder'],
  memory: ['memory'],
  graph: ['memory', 'coder'],
  dashboard: ['coder', 'ops'],
  telegram: ['coder', 'ops'],
  personal_reflection: ['reflection', 'planner'],
  emotional: ['reflection'],
  finance: ['critic'],
  learning: ['reflection', 'research']
};

function scoreAgent(agent, message, topics = [], risk = {}, context = {}) {
  let score = agent.id === 'orchestrator' ? 85 : 0;
  const mapped = unique(topics.flatMap(topic => TOPIC_AGENT_MAP[topic] || []));
  if (mapped.includes(agent.id)) score += 55;
  if (context.mentionedAgents?.includes(agent.id)) score = 100;
  if (risk.secretDetected && agent.id === 'security') score = 110;
  if ((risk.writeOrExternalIntent || risk.actionRequested) && agent.id === 'executor') score += 45;
  if (risk.level === 'danger' && agent.id === 'security') score += 35;
  if (agent.id === 'critic' && (topics.includes('planning') || topics.includes('roadmap'))) score += 18;
  if (topics.includes('emotional') && ['coder', 'ops', 'security'].includes(agent.id) && !context.mentionedAgents?.includes(agent.id)) score -= 80;
  if (topics.includes('casual') && agent.id !== 'orchestrator') score -= 80;
  score += Number(agent.priority || 0) / 10;
  return Math.max(0, Math.round(score));
}

function scoreAgentsForMessage(message, topics = [], risk = {}, context = {}, services = {}) {
  return agentRegistry.listAgents({ enabled: true }, services)
    .map(agent => ({
      agent,
      agentId: agent.id,
      score: scoreAgent(agent, message, topics, risk, context),
      reason: buildScoreReason(agent.id, topics, risk, context)
    }))
    .sort((a, b) => b.score - a.score);
}

function buildScoreReason(agentId, topics = [], risk = {}, context = {}) {
  if (context.mentionedAgents?.includes(agentId)) return 'mentioned directly';
  if (agentId === 'security' && risk.secretDetected) return 'secret/danger guard';
  if (agentId === 'executor' && risk.actionRequested) return 'execution intent';
  const matched = topics.filter(topic => (TOPIC_AGENT_MAP[topic] || []).includes(agentId));
  if (matched.length) return `matched topics: ${matched.join(', ')}`;
  if (agentId === 'orchestrator') return 'default moderator';
  return 'low relevance';
}

function selectTopAgents(scores = [], policy = {}) {
  const max = Number(policy.maxVisibleReplies || 3);
  const minScore = Number(policy.minScore || 45);
  const selected = [];
  const byId = new Map(scores.map(score => [score.agentId, score]));
  if (byId.has('orchestrator')) selected.push('orchestrator');
  for (const score of scores) {
    if (selected.includes(score.agentId)) continue;
    if (score.score < minScore) continue;
    selected.push(score.agentId);
    if (selected.length >= max) break;
  }
  if (policy.includeSecurity && byId.has('security') && !selected.includes('security')) {
    selected.push('security');
  }
  return selected;
}

function explainAgentSelection(scores = []) {
  return scores.slice(0, 8).map(item => ({
    agentId: item.agentId,
    score: item.score,
    reason: item.reason
  }));
}

module.exports = {
  TOPIC_AGENT_MAP,
  explainAgentSelection,
  scoreAgent,
  scoreAgentsForMessage,
  selectTopAgents
};
