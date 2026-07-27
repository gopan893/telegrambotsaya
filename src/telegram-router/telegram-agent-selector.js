'use strict';

const AGENT_MAP = {
  normal_chat: { agents: ['lifeos', 'general'], primary: 'lifeos', explanation: 'Percakapan umum' },
  coding: { agents: ['planner', 'coder', 'critic'], primary: 'coder', explanation: 'Tugas coding' },
  project: { agents: ['planner'], primary: 'planner', explanation: 'Perencanaan project' },
  ops: { agents: ['ops', 'security'], primary: 'ops', explanation: 'Operasional' },
  deploy: { agents: ['ops', 'security'], primary: 'ops', explanation: 'Deploy (proposal only)' },
  security: { agents: ['security', 'critic'], primary: 'security', explanation: 'Keamanan' },
  privacy: { agents: ['privacy', 'security'], primary: 'privacy', explanation: 'Privasi' },
  memory: { agents: ['memory', 'research'], primary: 'memory', explanation: 'Memori & RAG' },
  rag: { agents: ['memory', 'research'], primary: 'memory', explanation: 'RAG & Knowledge' },
  workflow: { agents: ['workflow', 'planner'], primary: 'workflow', explanation: 'Workflow' },
  device: { agents: ['device', 'ops'], primary: 'device', explanation: 'Perangkat' },
  approval: { agents: ['general'], primary: 'general', explanation: 'Approval' },
  research: { agents: ['research', 'memory'], primary: 'research', explanation: 'Research' },
  cost: { agents: ['general'], primary: 'general', explanation: 'Biaya & token' },
  model_strategy: { agents: ['general'], primary: 'general', explanation: 'Strategi model' },
  troubleshooting: { agents: ['general', 'coder'], primary: 'general', explanation: 'Troubleshooting' },
  dashboard: { agents: ['general'], primary: 'general', explanation: 'Dashboard' }
};

function selectAgentForTelegramIntent(intent, services) {
  const domain = intent.domain || 'normal_chat';
  const mapping = AGENT_MAP[domain];
  if (!mapping) return { agents: ['general'], primary: 'general', explanation: 'Domain tidak dikenal' };
  return { ...mapping };
}

function selectFallbackAgent(intent, services) {
  return { agents: ['general'], primary: 'general', explanation: 'Fallback ke agent general' };
}

function detectAgentMismatch(intent, selectedAgent, services) {
  if (!intent || !selectedAgent) return { mismatch: false };
  if (intent.domain === 'coding' && selectedAgent.primary !== 'coder') {
    return { mismatch: true, reason: 'coding_task_should_use_coder' };
  }
  if (intent.domain === 'security' && selectedAgent.primary === 'general') {
    return { mismatch: true, reason: 'security_task_should_use_security_agent' };
  }
  return { mismatch: false };
}

function buildAgentSelectionExplanation(intent, selectedAgent) {
  const domain = intent.domain || 'unknown';
  const explanation = selectedAgent.explanation || 'Agent umum';
  return 'Saya akan tangani ini sebagai ' + explanation + '.';
}

module.exports = {
  AGENT_MAP,
  buildAgentSelectionExplanation,
  detectAgentMismatch,
  selectAgentForTelegramIntent,
  selectFallbackAgent
};
