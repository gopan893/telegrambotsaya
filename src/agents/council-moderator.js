'use strict';

const {
  isArchitectureText,
  isDangerousActionText,
  isDecisionText,
  isPlanningText,
  sanitizeCouncilText,
  unique
} = require('./council-utils');

function chooseCouncilMode(message = '', topics = [], risk = {}, context = {}) {
  const text = String(message || '');
  const sourceMode = context.mode || context.forceMode || '';
  if (sourceMode === 'debate') return 'debate';
  if (sourceMode === 'risk_review') return 'risk_review';
  if (sourceMode === 'decision_review') return 'decision_review';
  if (sourceMode === 'coding_review') return 'coding_review';
  if (sourceMode === 'planning_review') return 'planning_review';
  if (risk.level === 'danger' || risk.level === 'high' || isDangerousActionText(text) || topics.includes('restore') || topics.includes('import') || topics.includes('security')) {
    return 'risk_review';
  }
  if (topics.includes('coding') || topics.includes('debugging') || topics.includes('database') || isArchitectureText(text)) {
    return isDecisionText(text) ? 'decision_review' : 'coding_review';
  }
  if (isDecisionText(text) || topics.includes('roadmap')) return 'decision_review';
  if (isPlanningText(text) || topics.includes('planning')) return 'planning_review';
  return 'quick_council';
}

function selectCouncilAgents(message = '', topics = [], risk = {}, context = {}, services = {}) {
  const mode = context.mode || chooseCouncilMode(message, topics, risk, context);
  let agents = ['orchestrator'];

  if (mode === 'quick_council') agents.push('planner', 'critic');
  if (mode === 'planning_review') agents.push('planner', 'critic');
  if (mode === 'decision_review') agents.push('planner', 'critic');
  if (mode === 'debate') agents.push('planner', 'critic');
  if (mode === 'deep_council') agents.push('planner', 'coder', 'critic', 'security');
  if (mode === 'coding_review') agents.push('coder', 'critic');
  if (mode === 'risk_review') agents.push('security', 'critic');

  if (topics.includes('coding') || topics.includes('debugging') || topics.includes('database')) agents.push('coder');
  if (topics.includes('ops') || topics.includes('deploy') || topics.includes('backup') || topics.includes('redis')) agents.push('ops');
  if (topics.includes('research') || topics.includes('search')) agents.push('research');
  if (topics.includes('memory') || topics.includes('graph')) agents.push('memory');
  if (risk.writeOrExternalIntent || risk.actionRequested || topics.includes('executor') || topics.includes('restore') || topics.includes('import')) agents.push('executor');
  if (risk.secretDetected || risk.level === 'danger' || risk.level === 'high' || topics.includes('security')) agents.push('security');

  if (topics.includes('emotional')) return ['orchestrator', 'reflection'];
  return unique(agents).slice(0, mode === 'deep_council' ? 5 : 4);
}

function decideVisibleVsInternalAgents(session = {}, policy = {}) {
  const selected = unique(session.selectedAgents || ['orchestrator']);
  if (session.source === 'natural_chat') {
    return {
      visibleAgents: ['orchestrator'],
      internalOnlyAgents: selected.filter(agentId => agentId !== 'orchestrator')
    };
  }
  const maxVisible = session.mode === 'deep_council' || session.mode === 'debate' ? 5 : 4;
  return {
    visibleAgents: selected.slice(0, maxVisible),
    internalOnlyAgents: selected.slice(maxVisible)
  };
}

function enforceCouncilLimits(session = {}) {
  const maxAgents = session.mode === 'deep_council' ? 5 : 4;
  return {
    ...session,
    selectedAgents: unique(session.selectedAgents || ['orchestrator']).slice(0, maxAgents)
  };
}

function buildCouncilInstructions(session = {}) {
  return [
    `Mode: ${session.mode}`,
    'Berikan opini ringkas, aman, dan tidak membocorkan hidden chain-of-thought.',
    'Tandai risiko dan approval jika ada write/external/danger action.',
    `Topik: ${sanitizeCouncilText(session.topic || session.originalMessage || '', 180)}`
  ].join('\n');
}

function buildCouncilIntroIfVisible(session = {}) {
  if (session.source === 'natural_chat') return '';
  return `Council ${session.mode} untuk: ${sanitizeCouncilText(session.topic || '', 160)}`;
}

function buildCouncilClosing(session = {}) {
  if (session.approvalRequired) return 'Aksi berisiko tetap membutuhkan proposal dan approval eksplisit.';
  return 'Ringkasan council selesai.';
}

module.exports = {
  buildCouncilClosing,
  buildCouncilInstructions,
  buildCouncilIntroIfVisible,
  chooseCouncilMode,
  decideVisibleVsInternalAgents,
  enforceCouncilLimits,
  selectCouncilAgents
};
