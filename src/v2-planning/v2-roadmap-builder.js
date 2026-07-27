'use strict';

const utils = require('./v2-planning-utils');
const scopeManager = require('./v2-scope-manager');

async function buildV2Roadmap(scopeItems, services) {
  const items = scopeItems || scopeManager.SCOPE_CATEGORIES;
  const prioritized = await scopeManager.prioritizeV2Scope(items, services);
  const phases = prioritized.data.map((item, index) => ({
    phase: index + 1,
    item: item.id || item.name,
    name: item.name || item.description,
    priority: item.priority || 'P3',
    estimatedDuration: estimatePhaseDuration(item.priority),
    dependencies: getPhaseDependencies(item.id || item.name)
  }));
  return { passed: true, data: phases, count: phases.length, score: 100 };
}

function estimatePhaseDuration(priority) {
  const map = { P0: '2-3 weeks', P1: '1-2 weeks', P2: '1 week', P3: '3-5 days' };
  return map[priority] || '1 week';
}

function getPhaseDependencies(scopeId) {
  const deps = {
    'registry-normalization': [],
    'dashboard-architecture': ['registry-normalization'],
    'command-router-cleanup': ['registry-normalization'],
    'capability-governance-cleanup': ['registry-normalization'],
    'api-contract-standardization': ['dashboard-architecture'],
    'storage-module-boundary': ['registry-normalization'],
    'test-harness-consolidation': ['command-router-cleanup', 'capability-governance-cleanup'],
    'performance-optimization': ['dashboard-architecture', 'api-contract-standardization'],
    'plugin-ecosystem-maturity': ['registry-normalization'],
    'rag-quality-improvement': ['api-contract-standardization'],
    'mobile-ux-maturity': ['dashboard-architecture'],
    'disaster-recovery-maturity': ['storage-module-boundary'],
    'reliability-slo-maturity': ['disaster-recovery-maturity', 'performance-optimization']
  };
  return deps[scopeId] || [];
}

async function prioritizeRoadmapPhases(phases, services) {
  if (!phases || !phases.length) return { passed: false, data: [], score: 0 };
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const sorted = [...phases].sort((a, b) => {
    const aPrio = priorityOrder[a.priority] || 3;
    const bPrio = priorityOrder[b.priority] || 3;
    if (aPrio !== bPrio) return aPrio - bPrio;
    return (a.phase || 0) - (b.phase || 0);
  });
  return { passed: true, data: sorted, count: sorted.length, score: 100 };
}

async function buildRoadmapReport(services) {
  const scope = await scopeManager.defineV2Scope(services);
  const roadmap = await buildV2Roadmap(scope.data, services);
  const prioritized = await prioritizeRoadmapPhases(roadmap.data, services);
  const byPriority = { P0: [], P1: [], P2: [], P3: [] };
  for (const phase of prioritized.data) {
    const p = phase.priority || 'P3';
    if (byPriority[p]) byPriority[p].push(phase);
  }
  const totalWeeks = prioritized.data.reduce((sum, p) => {
    const parts = p.estimatedDuration.split('-');
    const avg = parts.length > 1 ? (parseInt(parts[0]) + parseInt(parts[1])) / 2 : parseInt(parts[0]) || 1;
    return sum + avg;
  }, 0);
  return {
    passed: true,
    data: {
      totalPhases: prioritized.count,
      totalEstimatedWeeks: Math.round(totalWeeks),
      byPriority: {
        P0: { count: byPriority.P0.length, phases: byPriority.P0 },
        P1: { count: byPriority.P1.length, phases: byPriority.P1 },
        P2: { count: byPriority.P2.length, phases: byPriority.P2 },
        P3: { count: byPriority.P3.length, phases: byPriority.P3 }
      },
      phases: prioritized.data
    },
    score: 100
  };
}

module.exports = { buildV2Roadmap, prioritizeRoadmapPhases, buildRoadmapReport };
