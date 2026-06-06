'use strict';

const knowledge = require('../knowledge');

const REACT_DECISION_TOKEN = 'react';
const COMMON_DECISION_TERMS = ['react', 'next', 'vue', 'typescript', 'commonjs', 'shell', 'autonomous', 'auto-approve', 'approval', 'github push', 'deploy', 'rollback', 'fallback', 'overview', 'service worker', 'secret'];

function detectKnowledgeIntent(text = '', context = {}) {
  const clean = String(text || '').trim();
  if (!clean || clean.startsWith('/')) {
    return { hasKnowledgeIntent: false, knowledgeType: '', reason: 'empty_or_command' };
  }
  const lower = clean.toLowerCase();

  if (/^(halo|hai|hi|hello|ok|oke|sip|makasih|terima kasih|apa kabar|how are you)$/i.test(lower)) {
    return { hasKnowledgeIntent: false, knowledgeType: '', reason: 'simple_chat' };
  }

  if (/kenapa\s+(kita\s+)?tidak\s+pakai\s+(\w+)/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'decision_explain', target: 'react', source: context.source || 'natural_chat' };
  }
  if (/apa\s+(saja\s+)?keputusan\s+penting(\s+project(\s+ini)?)?/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'decision_summary', source: context.source || 'natural_chat' };
  }
  if (/apa\s+masalah\s+(\w+\s+)?deploy\s+terakhir/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'incident_lookup', source: context.source || 'natural_chat' };
  }
  if (/(?:apa\s+)?yang\s+harus\s+opencode\s+(baca|ketahui)\s+(sebelum\s+)?lanjut/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'handoff_context', source: context.source || 'natural_chat' };
  }
  if (/cari\s+konteks\s+(phase\s+)?(\d+|[a-z0-9 _-]+)/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'phase_context', source: context.source || 'natural_chat' };
  }
  if (/hapus\s+memory\s+yang\s+duplikat/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'memory_cleanup', source: context.source || 'natural_chat' };
  }
  if (/ingat\s+ini\s+sebagai\s+keputusan\s+project\s*[:\-]?\s*(.+)/i.test(clean)) {
    return { hasKnowledgeIntent: true, knowledgeType: 'decision_remember', source: context.source || 'natural_chat' };
  }
  return { hasKnowledgeIntent: false, knowledgeType: '', reason: 'no_knowledge_match' };
}

function retrieveKnowledgeForIntent(intent, services = {}) {
  if (!intent || !intent.hasKnowledgeIntent) return null;
  try {
    if (intent.knowledgeType === 'decision_explain') {
      return {
        type: 'decision',
        decisions: knowledge.decisionMemoryManager.searchDecisionMemory('React', services)
          .concat(knowledge.decisionMemoryManager.searchDecisionMemory('vanilla', services))
          .slice(0, 10)
      };
    }
    if (intent.knowledgeType === 'decision_summary') {
      return { type: 'decisions', decisions: knowledge.decisionMemoryManager.searchDecisionMemory('', services).slice(0, 20) };
    }
    if (intent.knowledgeType === 'incident_lookup') {
      return { type: 'incident', context: knowledge.contextRetrievalEngine.retrieveIncidentContext('deploy', services) };
    }
    if (intent.knowledgeType === 'handoff_context') {
      return { type: 'handoff', context: knowledge.contextRetrievalEngine.retrieveAgentHandoffContext('opencode', services) };
    }
    if (intent.knowledgeType === 'phase_context') {
      return { type: 'phase', context: knowledge.contextRetrievalEngine.retrievePhaseContext('last', services) };
    }
    if (intent.knowledgeType === 'memory_cleanup') {
      return { type: 'cleanup', plan: knowledge.memoryStalenessReviewer.createMemoryCleanupPlan({}, services) };
    }
    if (intent.knowledgeType === 'decision_remember') {
      return { type: 'remember', placeholder: true };
    }
  } catch (_) {
    return null;
  }
  return null;
}

module.exports = {
  detectKnowledgeIntent,
  retrieveKnowledgeForIntent,
  REACT_DECISION_TOKEN,
  COMMON_DECISION_TERMS
};
