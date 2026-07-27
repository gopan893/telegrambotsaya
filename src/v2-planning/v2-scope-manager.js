'use strict';

const utils = require('./v2-planning-utils');

const SCOPE_CATEGORIES = [
  { id: 'registry-normalization', name: 'Registry Normalization', description: 'Normalize registry v2 modules and eliminate duplication', priority: 'P0' },
  { id: 'dashboard-architecture', name: 'Dashboard Architecture Simplification', description: 'Simplify dashboard tab registration and fallback chains', priority: 'P0' },
  { id: 'command-router-cleanup', name: 'Command Router Cleanup', description: 'Clean up legacy command routing after Telegram Control layer', priority: 'P1' },
  { id: 'capability-governance-cleanup', name: 'Capability Governance Cleanup', description: 'Harden and consolidate capability governance', priority: 'P1' },
  { id: 'api-contract-standardization', name: 'API Contract Standardization', description: 'Standardize API contracts across all modules', priority: 'P1' },
  { id: 'storage-module-boundary', name: 'Storage/Module Boundary Cleanup', description: 'Clean up storage module boundaries', priority: 'P1' },
  { id: 'test-harness-consolidation', name: 'Test Harness Consolidation', description: 'Consolidate test harness patterns', priority: 'P2' },
  { id: 'performance-optimization', name: 'Performance Optimization', description: 'Optimize performance across the system', priority: 'P2' },
  { id: 'plugin-ecosystem-maturity', name: 'Plugin Ecosystem Maturity', description: 'Improve plugin ecosystem maturity', priority: 'P2' },
  { id: 'rag-quality-improvement', name: 'RAG Quality Improvement', description: 'Improve RAG quality for production readiness', priority: 'P2' },
  { id: 'mobile-ux-maturity', name: 'Mobile UX Maturity', description: 'Improve mobile UX maturity', priority: 'P3' },
  { id: 'disaster-recovery-maturity', name: 'Disaster Recovery Maturity', description: 'Improve disaster recovery maturity', priority: 'P3' },
  { id: 'reliability-slo-maturity', name: 'Reliability/SLO Maturity', description: 'Improve reliability and SLO maturity', priority: 'P3' }
];

async function defineV2Scope(services) {
  return { passed: true, data: SCOPE_CATEGORIES, count: SCOPE_CATEGORIES.length, score: 100 };
}

async function classifyV2Candidate(candidate, services) {
  if (!candidate || !candidate.type) return { passed: false, classification: null, score: 0 };
  const category = SCOPE_CATEGORIES.find(c => candidate.type === c.id || candidate.type === c.name);
  if (!category) return { passed: false, classification: 'uncategorized', score: 0 };
  return { passed: true, classification: category, score: 100 };
}

async function prioritizeV2Scope(items, services) {
  if (!items || !items.length) return { passed: false, data: [], score: 0 };
  const prioritized = [...items].sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const aPrio = a.priority || 'P3';
    const bPrio = b.priority || 'P3';
    return (priorityOrder[aPrio] || 3) - (priorityOrder[bPrio] || 3);
  });
  return { passed: true, data: prioritized, count: prioritized.length, score: 100 };
}

async function buildV2ScopeReport(items, services) {
  const scopeItems = items || SCOPE_CATEGORIES;
  const byPriority = { P0: [], P1: [], P2: [], P3: [] };
  for (const item of scopeItems) {
    const p = item.priority || 'P3';
    if (byPriority[p]) byPriority[p].push(item);
  }
  return {
    passed: true,
    data: {
      totalItems: scopeItems.length,
      byPriority: {
        P0: { count: byPriority.P0.length, items: byPriority.P0 },
        P1: { count: byPriority.P1.length, items: byPriority.P1 },
        P2: { count: byPriority.P2.length, items: byPriority.P2 },
        P3: { count: byPriority.P3.length, items: byPriority.P3 }
      }
    },
    score: 100
  };
}

module.exports = { defineV2Scope, classifyV2Candidate, prioritizeV2Scope, buildV2ScopeReport, SCOPE_CATEGORIES };
