'use strict';

const knowledge = require('../knowledge');

const KNOWLEDGE_COMMANDS = [
  '/knowledge', '/kg', '/remember_project', '/decision_memory',
  '/project_context', '/phase_context', '/incident_context',
  '/knowledge_search', '/memory_review', '/memory_cleanup',
  '/docs_status', '/contextpack'
];

const NATURAL_PATTERNS = [
  { re: /kenapa\s+(kita\s+)?tidak\s+pakai\s+(\w+)/i, type: 'decision' },
  { re: /apa\s+(saja\s+)?keputusan\s+penting(\s+project(\s+ini)?)?/i, type: 'decision' },
  { re: /apa\s+masalah\s+(\w+\s+)?deploy\s+terakhir/i, type: 'incident' },
  { re: /(?:apa\s+)?yang\s+harus\s+opencode\s+(baca|ketahui)\s+(sebelum\s+)?lanjut/i, type: 'handoff' },
  { re: /cari\s+konteks\s+(phase\s+)?(\d+|[a-z0-9 _-]+)/i, type: 'phase' },
  { re: /hapus\s+memory\s+yang\s+duplikat/i, type: 'cleanup' },
  { re: /ingat\s+ini\s+sebagai\s+keputusan\s+project\s*[:\-]?\s*(.+)/i, type: 'remember' }
];

function detectNaturalKnowledgeIntent(text) {
  if (!text || typeof text !== 'string') return { handled: false };
  for (const p of NATURAL_PATTERNS) {
    const m = text.match(p.re);
    if (m) return { handled: true, type: p.type, match: m };
  }
  return { handled: false };
}

function handleKnowledgeCommand(command, args, services = {}) {
  const safeArgs = String(args || '').slice(0, 500);
  switch (command) {
    case '/knowledge':
    case '/kg': {
      const summary = knowledge.knowledgeReportGenerator.buildKnowledgeGraphSummary(services.workspaceId || 'default', services);
      return { ok: true, type: 'summary', summary };
    }
    case '/decision_memory': {
      const decisions = safeArgs
        ? knowledge.decisionMemoryManager.searchDecisionMemory(safeArgs, services)
        : knowledge.knowledgeGraphStore.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 50 }, services);
      return { ok: true, type: 'decisions', decisions };
    }
    case '/remember_project': {
      const [title, ...rest] = safeArgs.split('|').map(s => s.trim());
      const summary = rest.join(' | ');
      if (!title) return { ok: false, error: 'TITLE_REQUIRED' };
      return knowledge.decisionMemoryManager.recordDecisionMemory({ title, summary }, services);
    }
    case '/project_context': {
      return { ok: true, type: 'project_context', context: knowledge.contextRetrievalEngine.retrieveProjectContext(safeArgs, services) };
    }
    case '/phase_context': {
      return { ok: true, type: 'phase_context', context: knowledge.contextRetrievalEngine.retrievePhaseContext(safeArgs, services) };
    }
    case '/incident_context': {
      return { ok: true, type: 'incident_context', context: knowledge.contextRetrievalEngine.retrieveIncidentContext(safeArgs, services) };
    }
    case '/knowledge_search': {
      return { ok: true, type: 'search', result: knowledge.knowledgeGraphStore.searchKnowledgeGraph(safeArgs, services) };
    }
    case '/memory_review': {
      return { ok: true, type: 'memory_review', plan: knowledge.memoryStalenessReviewer.createMemoryCleanupPlan({}, services) };
    }
    case '/memory_cleanup': {
      const plan = knowledge.memoryStalenessReviewer.createMemoryCleanupPlan({}, services);
      return { ok: true, type: 'cleanup_plan', plan, requireApproval: true, noHardDelete: true };
    }
    case '/docs_status': {
      return { ok: true, type: 'docs_status', suggestion: knowledge.documentationIntelligence.suggestDocumentationUpdates(services) };
    }
    case '/contextpack': {
      return { ok: true, type: 'contextpack', pack: knowledge.contextRetrievalEngine.buildContextPack(safeArgs, {}, services) };
    }
    default:
      return { ok: false, error: 'UNKNOWN_COMMAND' };
  }
}

function handleNaturalKnowledgeRoute(text, services = {}) {
  const intent = detectNaturalKnowledgeIntent(text);
  if (!intent.handled) return { handled: false };
  if (intent.type === 'remember') {
    const decision = String(intent.match[1] || '').trim();
    if (!decision) return { handled: true, blocked: true, safeSummary: 'A secret was provided and redacted.' };
    const res = knowledge.decisionMemoryManager.recordDecisionMemory({ title: decision.slice(0, 80), summary: decision }, services);
    if (!res.ok) return { handled: true, blocked: true, safeSummary: res.safeSummary || 'blocked' };
    return { handled: true, type: 'remembered', decision: res.decision };
  }
  if (intent.type === 'cleanup') {
    return { handled: true, type: 'cleanup', plan: knowledge.memoryStalenessReviewer.createMemoryCleanupPlan({}, services) };
  }
  if (intent.type === 'handoff') {
    return { handled: true, type: 'handoff', context: knowledge.contextRetrievalEngine.retrieveAgentHandoffContext('opencode handoff', services) };
  }
  if (intent.type === 'phase') {
    const phaseRef = (intent.match[2] || '').trim();
    return { handled: true, type: 'phase_context', context: knowledge.contextRetrievalEngine.retrievePhaseContext(phaseRef, services) };
  }
  if (intent.type === 'incident') {
    return { handled: true, type: 'incident_context', context: knowledge.contextRetrievalEngine.retrieveIncidentContext(text, services) };
  }
  if (intent.type === 'decision') {
    const decisionTerm = (intent.match[2] || '').trim();
    const decisions = knowledge.decisionMemoryManager.searchDecisionMemory(decisionTerm, services);
    return { handled: true, type: 'decisions', decisions };
  }
  return { handled: false };
}

function isKnowledgeCommand(command) {
  return KNOWLEDGE_COMMANDS.includes(String(command || '').toLowerCase());
}

module.exports = {
  KNOWLEDGE_COMMANDS,
  detectNaturalKnowledgeIntent,
  handleKnowledgeCommand,
  handleNaturalKnowledgeRoute,
  isKnowledgeCommand
};
