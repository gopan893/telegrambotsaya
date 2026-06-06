'use strict';

const AGENT_ROLES = {
  orchestrator: { name: 'Orchestrator', capability: 'final_synthesis', cost: 'medium' },
  planner: { name: 'Planner', capability: 'roadmap_tasks', cost: 'low' },
  coder: { name: 'Coder', capability: 'implementation_plan', cost: 'medium' },
  critic: { name: 'Critic', capability: 'regression_risk', cost: 'low' },
  security: { name: 'Security', capability: 'secret_approval_risk', cost: 'low' },
  executor: { name: 'Executor', capability: 'proposal_bridge', cost: 'low' },
  ops: { name: 'Ops', capability: 'deploy_monitoring', cost: 'low' },
  cost: { name: 'Cost', capability: 'budget_token_guard', cost: 'low' },
  reflection: { name: 'Reflection', capability: 'personal_support', cost: 'low' }
};

function selectAgentsForOperatorTask(task) {
  if (!task) return [];
  const type = task.type || 'planning';
  const risk = task.riskLevel || 'low';
  const agents = [{ role: 'orchestrator', agent: AGENT_ROLES.orchestrator }];

  if (type === 'planning') agents.push({ role: 'planner', agent: AGENT_ROLES.planner });
  if (type === 'coding') agents.push({ role: 'coder', agent: AGENT_ROLES.coder });
  if (type === 'review' || type === 'testing' || risk === 'high') {
    agents.push({ role: 'critic', agent: AGENT_ROLES.critic });
    agents.push({ role: 'security', agent: AGENT_ROLES.security });
  }
  if (type === 'deployment') {
    agents.push({ role: 'ops', agent: AGENT_ROLES.ops });
    agents.push({ role: 'security', agent: AGENT_ROLES.security });
  }
  if (type === 'evaluation') agents.push({ role: 'critic', agent: AGENT_ROLES.critic });
  if (type !== 'planning' && type !== 'monitoring') {
    agents.push({ role: 'cost', agent: AGENT_ROLES.cost });
  }
  if (task.requiresApproval || risk === 'high') {
    agents.push({ role: 'executor', agent: AGENT_ROLES.executor });
  }
  if (task.requiresApproval && !agents.some(a => a.role === 'security')) {
    agents.push({ role: 'security', agent: AGENT_ROLES.security });
  }
  return agents;
}

function coordinateAgentWork(task) {
  const agents = selectAgentsForOperatorTask(task);
  return {
    taskId: task.id,
    agents,
    plan: agents.map(a => `${a.role} (${a.agent.capability})`),
    prohibitSpam: agents.length > 4,
    summary: `${agents.length} agents selected: ${agents.map(a => a.role).join(', ')}`
  };
}

function collectAgentOpinions(task) {
  const coordination = coordinateAgentWork(task);
  return coordination.agents.map(a => ({
    role: a.role,
    opinion: `${a.agent.name} reviews task "${task.title}" for ${a.agent.capability}.`,
    capability: a.agent.capability
  }));
}

function synthesizeAgentResult(task) {
  const opinions = collectAgentOpinions(task);
  const hasSecurity = opinions.some(o => o.role === 'security');
  const hasCritic = opinions.some(o => o.role === 'critic');
  const hasCostGuard = opinions.some(o => o.role === 'cost');
  return {
    taskId: task.id,
    synthesizedBy: 'orchestrator',
    approved: !(hasSecurity && task.riskLevel === 'high'),
    warnings: hasCritic ? ['Critic review recommended before proceeding'] : [],
    costChecked: hasCostGuard,
    securityChecked: hasSecurity,
    opinions
  };
}

function preventAgentSpam(task) {
  const agents = selectAgentsForOperatorTask(task);
  if (agents.length <= 5) return { limited: false, agents };
  const essential = agents.filter(a => ['orchestrator', 'coder', 'security', 'executor'].includes(a.role));
  return { limited: true, agents: essential, reason: 'Spam prevention: reduced from ' + agents.length + ' to ' + essential.length };
}

module.exports = {
  selectAgentsForOperatorTask,
  coordinateAgentWork,
  collectAgentOpinions,
  synthesizeAgentResult,
  preventAgentSpam,
  AGENT_ROLES
};
