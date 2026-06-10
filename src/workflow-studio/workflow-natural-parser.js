'use strict';

const utils = require('./workflow-utils');

function parseNaturalLanguage(input) {
  if (!input || typeof input !== 'string') return { ok: false, error: 'Invalid input' };
  const text = input.trim();
  if (text.length === 0) return { ok: false, error: 'Empty input' };

  const steps = [];
  const lower = text.toLowerCase();

  if (lower.includes('send') && (lower.includes('message') || lower.includes('notification'))) {
    steps.push({ type: 'notify', name: 'Send notification', channel: 'default', message: text });
  }
  if (lower.includes('check') || lower.includes('monitor') || lower.includes('health')) {
    steps.push({ type: 'read', name: 'Health check', source: 'system' });
  }
  if (lower.includes('backup') || lower.includes('save')) {
    steps.push({ type: 'internal_write', name: 'Backup data', target: 'backup' });
  }
  if (lower.includes('deploy') || lower.includes('release')) {
    steps.push({ type: 'external_write', name: 'Deploy action', target: 'production', action: 'deploy' });
  }
  if (lower.includes('search') || lower.includes('find') || lower.includes('look up')) {
    steps.push({ type: 'rag_search', name: 'RAG search', query: text });
  }
  if (lower.includes('analyze') || lower.includes('summarize')) {
    steps.push({ type: 'analyze', name: 'Analyze data', source: 'system' });
  }

  if (steps.length === 0) {
    steps.push({ type: 'read', name: 'Default read action', source: 'system' });
  }

  return {
    ok: true,
    originalInput: text,
    steps,
    stepCount: steps.length,
    riskLevel: steps.some(s => s.type === 'external_write') ? 'medium' : 'low',
    timestamp: new Date().toISOString()
  };
}

function classifyIntent(input) {
  if (!input || typeof input !== 'string') return 'unknown';
  const lower = input.toLowerCase();
  if (lower.includes('deploy') || lower.includes('release')) return 'deployment';
  if (lower.includes('backup') || lower.includes('save')) return 'backup';
  if (lower.includes('monitor') || lower.includes('health')) return 'monitoring';
  if (lower.includes('search') || lower.includes('find')) return 'search';
  if (lower.includes('send') || lower.includes('notify')) return 'notification';
  if (lower.includes('analyze') || lower.includes('summarize')) return 'analysis';
  return 'general';
}

module.exports = { parseNaturalLanguage, classifyIntent };
