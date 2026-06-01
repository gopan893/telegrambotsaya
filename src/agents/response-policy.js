'use strict';

const agentRegistry = require('./agent-registry');
const scoring = require('./agent-scoring');
const { unique } = require('./agent-utils');

function decideResponsePolicy(message, context = {}, scores = [], risk = {}, services = {}) {
  const commandMode = context.commandMode || 'natural_smart';
  const topics = context.topics || [];
  let mode = commandMode === 'command' ? 'normal' : commandMode;
  let selectedAgents = [];
  let maxVisibleReplies = Number(context.groupSettings?.maxAutoAgents || 3);
  let requireOrchestratorSummary = false;
  let approvalRequired = Boolean(risk.writeOrExternalIntent || risk.dangerIntent || risk.secretDetected);

  if (topics.includes('casual')) {
    mode = 'normal';
    selectedAgents = ['orchestrator'];
  } else if (topics.includes('emotional')) {
    mode = 'emotional_support';
    selectedAgents = ['orchestrator', 'reflection'];
    maxVisibleReplies = 2;
  } else if (context.mentionedAgents?.length) {
    mode = 'mention';
    selectedAgents = unique(['orchestrator', ...context.mentionedAgents]);
  } else if (mode === 'quiet' || context.groupSettings?.mode === 'quiet') {
    mode = 'quiet';
    selectedAgents = ['orchestrator'];
  } else if (mode === 'council') {
    selectedAgents = ['orchestrator', 'planner', 'coder', 'critic', 'security'];
    maxVisibleReplies = 5;
    requireOrchestratorSummary = true;
  } else if (mode === 'debate') {
    selectedAgents = unique(['orchestrator', 'planner', 'critic', risk.level === 'high' || risk.level === 'danger' ? 'security' : '']);
    maxVisibleReplies = 4;
    requireOrchestratorSummary = true;
  } else if (mode === 'allagents') {
    selectedAgents = agentRegistry.listAgents({ enabled: true }, services).map(agent => agent.id);
    maxVisibleReplies = selectedAgents.length;
    requireOrchestratorSummary = true;
  } else if (mode === 'risk_review') {
    selectedAgents = ['orchestrator', 'critic', 'security'];
    maxVisibleReplies = 3;
    requireOrchestratorSummary = true;
  } else if (risk.writeOrExternalIntent || risk.actionRequested) {
    mode = 'execution_proposal';
    selectedAgents = unique(['orchestrator', 'executor', 'security', (topics.includes('backup') || topics.includes('restore') || topics.includes('ops')) ? 'ops' : '']);
    maxVisibleReplies = (topics.includes('backup') || topics.includes('restore')) ? 4 : 3;
    approvalRequired = true;
  } else if (risk.level === 'high' || risk.level === 'danger') {
    mode = 'risk_review';
    selectedAgents = unique(['orchestrator', 'security', 'critic']);
    maxVisibleReplies = 3;
  } else {
    mode = 'natural_smart';
    if (topics.includes('planning') && (topics.includes('dashboard') || topics.includes('coding') || topics.includes('debugging'))) {
      maxVisibleReplies = Math.max(maxVisibleReplies, 4);
    }
    selectedAgents = scoring.selectTopAgents(scores, {
      maxVisibleReplies,
      includeSecurity: risk.secretDetected || risk.level === 'danger',
      minScore: 48
    });
  }

  if (!selectedAgents.includes('orchestrator')) selectedAgents.unshift('orchestrator');
  selectedAgents = unique(selectedAgents).filter(Boolean);

  const visible = selectedAgents.slice(0, maxVisibleReplies);
  if ((risk.level === 'high' || risk.level === 'danger' || risk.secretDetected) && !visible.includes('security')) {
    visible.push('security');
  }
  const internalOnlyAgents = selectedAgents.filter(agentId => !visible.includes(agentId));
  const enabledIds = agentRegistry.listAgents({ enabled: true }, services).map(agent => agent.id);
  const mutedAgents = enabledIds.filter(agentId => !visible.includes(agentId) && !internalOnlyAgents.includes(agentId));

  return enforceAntiSpamPolicy({
    mode,
    selectedAgents: unique(visible),
    internalOnlyAgents,
    mutedAgents,
    maxVisibleReplies,
    requireOrchestratorSummary,
    riskLevel: risk.level || risk.riskLevel || 'low',
    approvalRequired,
    reason: buildPolicyReason(mode, topics, risk)
  }, context);
}

function buildPolicyReason(mode, topics = [], risk = {}) {
  if (mode === 'emotional_support') return 'emotional message routed to reflection support';
  if (mode === 'execution_proposal') return 'action/write intent requires human approval';
  if (mode === 'risk_review') return 'high risk message requires security review';
  if (mode === 'quiet') return 'group is in quiet mode';
  if (mode === 'council' || mode === 'debate' || mode === 'allagents') return `${mode} override requested`;
  return `natural smart routing for topics: ${topics.join(', ') || 'unknown'}`;
}

function shouldAgentRespond(agentId, policy = {}) {
  return (policy.selectedAgents || []).includes(agentId);
}

function shouldAgentSpeakInternally(agentId, policy = {}) {
  return (policy.internalOnlyAgents || []).includes(agentId);
}

function buildResponseOrder(policy = {}) {
  const selected = policy.selectedAgents || [];
  const withoutOrchestrator = selected.filter(id => id !== 'orchestrator');
  return selected.includes('orchestrator') ? ['orchestrator', ...withoutOrchestrator] : selected;
}

function enforceAntiSpamPolicy(policy = {}, context = {}) {
  const max = Number(policy.maxVisibleReplies || context.groupSettings?.maxAutoAgents || 3);
  if (policy.mode !== 'allagents' && policy.selectedAgents.length > max) {
    const keep = policy.selectedAgents.slice(0, max);
    if ((policy.riskLevel === 'danger' || policy.riskLevel === 'high') && policy.selectedAgents.includes('security') && !keep.includes('security')) {
      keep[keep.length - 1] = 'security';
    }
    return {
      ...policy,
      selectedAgents: unique(keep),
      internalOnlyAgents: unique([...(policy.internalOnlyAgents || []), ...policy.selectedAgents.slice(max)])
    };
  }
  return policy;
}

function buildNoResponseReason(agentId, policy = {}) {
  if (policy.mutedAgents?.includes(agentId)) return 'agent muted by routing policy';
  if (policy.internalOnlyAgents?.includes(agentId)) return 'agent opinion kept internal for anti-spam';
  return 'agent not selected';
}

module.exports = {
  buildNoResponseReason,
  buildResponseOrder,
  decideResponsePolicy,
  enforceAntiSpamPolicy,
  shouldAgentRespond,
  shouldAgentSpeakInternally
};
