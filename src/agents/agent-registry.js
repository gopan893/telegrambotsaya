'use strict';

const { normalizeId, nowIso } = require('./agent-utils');
const personality = require('./agent-personality');

const DEFAULT_AGENTS = [
  {
    id: 'orchestrator',
    displayName: 'Orchestrator Agent',
    botId: 'default',
    role: 'moderator',
    description: 'Moderator utama yang memilih agent, menjaga konteks, dan merangkum keputusan.',
    personality: 'tenang, ringkas, kooperatif',
    specialties: ['routing', 'summary', 'coordination', 'general_chat'],
    tools: ['planner', 'memory', 'executor', 'dashboard'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: true,
    canExecuteWithoutApproval: false,
    defaultSilent: false,
    priority: 100,
    maxAutoReplies: 1,
    riskSensitivity: 'medium',
    enabled: true
  },
  {
    id: 'planner',
    displayName: 'Planner Agent',
    botId: 'planner',
    role: 'planning',
    description: 'Membantu roadmap, prioritas, milestone, dan task orchestration.',
    personality: 'terstruktur dan praktis',
    specialties: ['planning', 'roadmap', 'goal', 'workflow', 'priority', 'task'],
    tools: ['planner', 'workflow'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: true,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 80,
    maxAutoReplies: 1,
    riskSensitivity: 'medium',
    enabled: true
  },
  {
    id: 'coder',
    displayName: 'Coder Agent',
    botId: 'coder',
    role: 'engineering',
    description: 'Fokus pada coding, debugging, arsitektur backend, dan deployment bugfix.',
    personality: 'teknis, teliti, langsung',
    specialties: ['coding', 'debugging', 'database', 'api', 'telegram', 'render'],
    tools: ['ops', 'tool_registry'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: true,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 75,
    maxAutoReplies: 1,
    riskSensitivity: 'medium',
    enabled: true
  },
  {
    id: 'critic',
    displayName: 'Critic Agent',
    botId: 'critic',
    role: 'review',
    description: 'Mencari risiko, blind spot, trade-off, dan kelemahan rencana.',
    personality: 'skeptis sehat dan konstruktif',
    specialties: ['risk', 'review', 'tradeoff', 'blindspot', 'roadmap'],
    tools: ['audit'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: false,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 70,
    maxAutoReplies: 1,
    riskSensitivity: 'high',
    enabled: true
  },
  {
    id: 'research',
    displayName: 'Research Agent',
    botId: 'research',
    role: 'research',
    description: 'Membantu riset, search, API, sumber, dan pembelajaran teknologi.',
    personality: 'penasaran dan evidence-aware',
    specialties: ['research', 'search', 'latest', 'api', 'learning'],
    tools: ['search.web'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: false,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 68,
    maxAutoReplies: 1,
    riskSensitivity: 'medium',
    enabled: true
  },
  {
    id: 'ops',
    displayName: 'Ops Agent',
    botId: 'ops',
    role: 'operations',
    description: 'Fokus pada Render, health, Redis, PostgreSQL, backup status, dan stabilitas.',
    personality: 'operasional dan stabilitas-first',
    specialties: ['ops', 'deploy', 'health', 'redis', 'postgresql', 'backup'],
    tools: ['ops.diagnostics.run', 'recovery.check'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: true,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 72,
    maxAutoReplies: 1,
    riskSensitivity: 'high',
    enabled: true
  },
  {
    id: 'security',
    displayName: 'Security Agent',
    botId: 'security',
    role: 'security',
    description: 'Menjaga token, secret, permission, restore/import, dan approval safety.',
    personality: 'tegas, aman, tidak membocorkan rahasia',
    specialties: ['security', 'secret', 'permission', 'restore', 'import', 'danger'],
    tools: ['audit', 'executor'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: true,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 90,
    maxAutoReplies: 1,
    riskSensitivity: 'danger',
    enabled: true
  },
  {
    id: 'memory',
    displayName: 'Memory Agent',
    botId: 'memory',
    role: 'context',
    description: 'Mengambil konteks relevan dari memory, graph, goals, dan insights.',
    personality: 'kontekstual dan ringkas',
    specialties: ['memory', 'graph', 'context', 'insight', 'workspace'],
    tools: ['graph.search', 'memory'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: false,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 65,
    maxAutoReplies: 1,
    riskSensitivity: 'medium',
    enabled: true
  },
  {
    id: 'executor',
    displayName: 'Executor Agent',
    botId: 'executor',
    role: 'execution',
    description: 'Membuat proposal eksekusi yang wajib disetujui manusia sebelum dijalankan.',
    personality: 'hati-hati dan approval-first',
    specialties: ['executor', 'approval', 'run', 'action', 'backup'],
    tools: ['executor', 'tool_registry'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: true,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 82,
    maxAutoReplies: 1,
    riskSensitivity: 'danger',
    enabled: true
  },
  {
    id: 'reflection',
    displayName: 'Reflection Agent',
    botId: 'reflection',
    role: 'reflection',
    description: 'Membantu refleksi personal, emosi, kebingungan, dan dukungan belajar.',
    personality: 'tenang, empatik, tidak berlebihan',
    specialties: ['emotional', 'personal_reflection', 'learning', 'motivation'],
    tools: ['journal'],
    canSpeakDirectly: true,
    canAutoRespond: true,
    canProposeExecution: false,
    canExecuteWithoutApproval: false,
    defaultSilent: true,
    priority: 66,
    maxAutoReplies: 1,
    riskSensitivity: 'low',
    enabled: true
  }
];

function attachBotIds(agents = [], services = {}) {
  const bots = services.botRegistry?.listBotConfigsSafe?.(services.env || process.env) || [];
  const botIds = new Set(bots.map(bot => bot.id));
  return agents.map(agent => {
    const preferredBotId = agent.id === 'orchestrator'
      ? (botIds.has('default') ? 'default' : (botIds.has('orchestrator') ? 'orchestrator' : 'default'))
      : agent.id;
    const botId = botIds.has(preferredBotId) ? preferredBotId : agent.botId;
    return { ...agent, botId };
  });
}

function loadDefaultAgents(services = {}) {
  return attachBotIds(DEFAULT_AGENTS.map(agent => {
    const profile = personality.getDefaultAgentProfile(agent.id);
    return personality.mergeAgentProfile({ ...agent, updatedAt: nowIso() }, profile);
  }), services);
}

function listAgents(filters = {}, services = {}) {
  const agents = loadDefaultAgents(services);
  return agents.filter(agent => {
    if (filters.enabled !== undefined && Boolean(agent.enabled) !== Boolean(filters.enabled)) return false;
    if (filters.role && agent.role !== filters.role) return false;
    return true;
  });
}

function getAgent(agentId, services = {}) {
  const cleanId = normalizeId(agentId);
  return listAgents({}, services).find(agent => agent.id === cleanId) || null;
}

function getAgentByBotId(botId, services = {}) {
  const cleanId = normalizeId(botId);
  return listAgents({}, services).find(agent => agent.botId === cleanId) || null;
}

function updateAgentRuntimeStatus(agentId, patch = {}, services = {}) {
  const agent = getAgent(agentId, services);
  if (!agent) return null;
  return { ...agent, runtime: { ...(agent.runtime || {}), ...patch, updatedAt: nowIso() } };
}

function buildAgentSafeSummary(agent = {}) {
  return {
    id: agent.id,
    displayName: agent.displayName,
    botId: agent.botId,
    role: agent.role,
    description: agent.description,
    personality: agent.personality,
    specialties: Array.isArray(agent.specialties) ? agent.specialties.slice(0, 20) : [],
    tools: Array.isArray(agent.tools) ? agent.tools.slice(0, 20) : [],
    canSpeakDirectly: Boolean(agent.canSpeakDirectly),
    canAutoRespond: Boolean(agent.canAutoRespond),
    canProposeExecution: Boolean(agent.canProposeExecution),
    canExecuteWithoutApproval: false,
    defaultSilent: Boolean(agent.defaultSilent),
    priority: Number(agent.priority || 0),
    maxAutoReplies: Number(agent.maxAutoReplies || 1),
    riskSensitivity: agent.riskSensitivity || 'medium',
    responseStyle: agent.responseStyle || {},
    memoryPolicy: agent.memoryPolicy || {},
    knowledgeScope: Array.isArray(agent.knowledgeScope) ? agent.knowledgeScope.slice(0, 24) : [],
    learningNotesEnabled: agent.learningNotesEnabled !== false,
    agentMemoryEnabled: agent.agentMemoryEnabled !== false,
    sharedMemoryEnabled: agent.sharedMemoryEnabled !== false,
    updatedAt: agent.updatedAt || null,
    enabled: agent.enabled !== false
  };
}

module.exports = {
  DEFAULT_AGENTS,
  buildAgentSafeSummary,
  getAgent,
  getAgentByBotId,
  listAgents,
  loadDefaultAgents,
  updateAgentRuntimeStatus
};
