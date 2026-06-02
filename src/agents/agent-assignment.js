'use strict';

const agentRegistry = require('./agent-registry');
const utils = require('./delegation-utils');

const TYPE_AGENT_MAP = {
  planning: ['planner', 'orchestrator'],
  coding_review: ['coder', 'critic', 'orchestrator'],
  risk_review: ['security', 'critic', 'ops', 'orchestrator'],
  research_note: ['research', 'orchestrator'],
  ops_check: ['ops', 'coder', 'orchestrator'],
  memory_review: ['memory', 'orchestrator'],
  decision_support: ['planner', 'critic', 'orchestrator'],
  summary: ['orchestrator'],
  handoff: ['orchestrator']
};

function validateAgentCanHandleTask(agent = {}, task = {}) {
  if (!agent || agent.enabled === false) return false;
  const preferred = TYPE_AGENT_MAP[task.type] || ['orchestrator'];
  if (preferred.includes(agent.id)) return true;
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  return (agent.specialties || []).some(item => text.includes(String(item).toLowerCase()));
}

function scoreAgent(agent = {}, task = {}, context = {}) {
  let score = 0;
  const preferred = TYPE_AGENT_MAP[task.type] || [];
  const preferredIndex = preferred.indexOf(agent.id);
  if (preferredIndex >= 0) score += 100 - preferredIndex * 10;
  if (task.riskLevel === 'danger' && ['security', 'executor'].includes(agent.id)) score += 40;
  if (task.type === 'coding_review' && agent.id === 'coder') score += 30;
  if (task.type === 'ops_check' && agent.id === 'ops') score += 30;
  if ((context.topics || []).includes(agent.id)) score += 15;
  score += Number(agent.priority || 0) / 10;
  return score;
}

function rankAgentsForTask(task = {}, agents = [], context = {}) {
  return agents
    .filter(agent => validateAgentCanHandleTask(agent, task))
    .map(agent => ({ agent, score: scoreAgent(agent, task, context) }))
    .sort((a, b) => b.score - a.score);
}

function fallbackAgentForTask(task = {}, services = {}) {
  const fallbackId = task.type === 'risk_review' ? 'security' : 'orchestrator';
  return agentRegistry.getAgent(fallbackId, services) || agentRegistry.getAgent('orchestrator', services);
}

function explainAssignment(task = {}, agent = {}) {
  const type = task.type || 'planning';
  if (agent.id === 'orchestrator') return `Fallback ke Orchestrator untuk task ${type}.`;
  return `${agent.displayName || agent.id} cocok untuk task ${type} karena role/specialty relevan.`;
}

function assignTaskToAgent(task = {}, availableAgents = null, context = {}, services = {}) {
  const agents = availableAgents || agentRegistry.listAgents({}, services);
  const ranked = rankAgentsForTask(task, agents, context);
  const chosen = ranked[0]?.agent || fallbackAgentForTask(task, services);
  const botId = chosen?.botId || chosen?.id || 'default';
  return utils.sanitizeDelegationPayload({
    ...task,
    assignedAgentId: chosen?.id || 'orchestrator',
    assignedBotId: botId,
    assignmentReason: explainAssignment(task, chosen || {})
  });
}

module.exports = {
  assignTaskToAgent,
  explainAssignment,
  fallbackAgentForTask,
  rankAgentsForTask,
  validateAgentCanHandleTask
};
