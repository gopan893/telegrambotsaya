'use strict';

const store = require('./improvement-store');
const utils = require('./improvement-utils');

function buildPattern(data) {
  return {
    type: data.type || 'unknown',
    title: data.title || 'Untitled Pattern',
    summary: data.summary || '',
    frequency: Math.max(1, data.frequency || 1),
    affectedModules: Array.isArray(data.affectedModules) ? data.affectedModules : [],
    firstSeenAt: data.firstSeenAt || new Date().toISOString(),
    lastSeenAt: data.lastSeenAt || new Date().toISOString(),
    evidence: Array.isArray(data.evidence) ? data.evidence : []
  };
}

async function analyzeImprovementPatterns(filters, services) {
  const patterns = [];
  const all = store.list(filters);

  const dashboardRoutes = all.filter(item =>
    item.text && item.text.toLowerCase().includes('dashboard') &&
    (item.text.toLowerCase().includes('route') || item.text.toLowerCase().includes('tab'))
  );
  if (dashboardRoutes.length >= 2) {
    patterns.push(buildPattern({
      type: 'dashboard_route_mismatch',
      title: 'Dashboard route mismatch repeats',
      summary: `${dashboardRoutes.length} dashboard route mismatches detected`,
      frequency: dashboardRoutes.length,
      affectedModules: ['dashboard'],
      firstSeenAt: dashboardRoutes[0].createdAt || dashboardRoutes[0].firstSeenAt,
      lastSeenAt: dashboardRoutes[dashboardRoutes.length - 1].createdAt || dashboardRoutes[dashboardRoutes.length - 1].lastSeenAt,
      evidence: dashboardRoutes.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  const pwaCache = all.filter(item =>
    item.text && item.text.includes('telegram-aios-dashboard-static')
  );
  if (pwaCache.length >= 2) {
    patterns.push(buildPattern({
      type: 'pwa_cache_version',
      title: 'PWA cache version repeats',
      summary: `${pwaCache.length} references to stale PWA cache version`,
      frequency: pwaCache.length,
      affectedModules: ['dashboard'],
      firstSeenAt: pwaCache[0].createdAt || pwaCache[0].firstSeenAt,
      lastSeenAt: pwaCache[pwaCache.length - 1].createdAt || pwaCache[pwaCache.length - 1].lastSeenAt,
      evidence: pwaCache.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  const wrongRouting = all.filter(item =>
    item.text && item.text.toLowerCase().includes('natural') &&
    (item.text.toLowerCase().includes('coder') || item.text.toLowerCase().includes('domain') || item.text.toLowerCase().includes('routing'))
  );
  if (wrongRouting.length >= 2) {
    patterns.push(buildPattern({
      type: 'wrong_natural_chat_domain_routing',
      title: 'Wrong natural chat domain routing repeats',
      summary: `${wrongRouting.length} instances of natural chat routed to wrong domain`,
      frequency: wrongRouting.length,
      affectedModules: ['routing', 'natural-language'],
      firstSeenAt: wrongRouting[0].createdAt || wrongRouting[0].firstSeenAt,
      lastSeenAt: wrongRouting[wrongRouting.length - 1].createdAt || wrongRouting[wrongRouting.length - 1].lastSeenAt,
      evidence: wrongRouting.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  const handoffGaps = all.filter(item =>
    item.text && item.text.toLowerCase().includes('handoff') &&
    (item.text.toLowerCase().includes('gap') || item.text.toLowerCase().includes('miss') || item.text.toLowerCase().includes('incomplete'))
  );
  if (handoffGaps.length >= 2) {
    patterns.push(buildPattern({
      type: 'handoff_gap',
      title: 'OpenCode/Codex handoff gaps repeat',
      summary: `${handoffGaps.length} handoff gap instances detected`,
      frequency: handoffGaps.length,
      affectedModules: ['operator', 'executor'],
      firstSeenAt: handoffGaps[0].createdAt || handoffGaps[0].firstSeenAt,
      lastSeenAt: handoffGaps[handoffGaps.length - 1].createdAt || handoffGaps[handoffGaps.length - 1].lastSeenAt,
      evidence: handoffGaps.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  const deployMissing = all.filter(item =>
    item.text && item.text.toLowerCase().includes('deploy') &&
    (item.text.toLowerCase().includes('missing') || item.text.toLowerCase().includes('dependency'))
  );
  if (deployMissing.length >= 2) {
    patterns.push(buildPattern({
      type: 'render_deploy_missing_dependency',
      title: 'Render deploy missing dependency repeats',
      summary: `${deployMissing.length} deploy failures due to missing dependencies`,
      frequency: deployMissing.length,
      affectedModules: ['deploy'],
      firstSeenAt: deployMissing[0].createdAt || deployMissing[0].firstSeenAt,
      lastSeenAt: deployMissing[deployMissing.length - 1].createdAt || deployMissing[deployMissing.length - 1].lastSeenAt,
      evidence: deployMissing.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  const costSpikes = all.filter(item =>
    item.text && (item.text.toLowerCase().includes('cost spike') || item.text.toLowerCase().includes('prompt too large'))
  );
  if (costSpikes.length >= 2) {
    patterns.push(buildPattern({
      type: 'cost_spike',
      title: 'Prompt too large / cost spike repeats',
      summary: `${costSpikes.length} cost spike or oversized prompt instances`,
      frequency: costSpikes.length,
      affectedModules: ['cost', 'executor'],
      firstSeenAt: costSpikes[0].createdAt || costSpikes[0].firstSeenAt,
      lastSeenAt: costSpikes[costSpikes.length - 1].createdAt || costSpikes[costSpikes.length - 1].lastSeenAt,
      evidence: costSpikes.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  const proposalRejections = all.filter(item =>
    item.text && item.text.toLowerCase().includes('proposal') &&
    (item.text.toLowerCase().includes('reject') || item.text.toLowerCase().includes('denied'))
  );
  if (proposalRejections.length >= 2) {
    patterns.push(buildPattern({
      type: 'proposal_rejection',
      title: 'Same proposal rejected repeatedly',
      summary: `${proposalRejections.length} proposal rejection instances`,
      frequency: proposalRejections.length,
      affectedModules: ['executor'],
      firstSeenAt: proposalRejections[0].createdAt || proposalRejections[0].firstSeenAt,
      lastSeenAt: proposalRejections[proposalRejections.length - 1].createdAt || proposalRejections[proposalRejections.length - 1].lastSeenAt,
      evidence: proposalRejections.map(r => r.id || r.text).filter(Boolean)
    }));
  }

  return patterns;
}

async function findRepeatedFailures(filters, services) {
  const patterns = await analyzeImprovementPatterns({ ...filters, type: 'failure' }, services);
  return patterns.filter(p =>
    p.type.includes('failure') || p.type.includes('deploy') || p.type.includes('route')
  );
}

async function findRegressionPatterns(filters, services) {
  const patterns = await analyzeImprovementPatterns(filters, services);
  return patterns.filter(p =>
    p.type === 'pwa_cache_version' || p.type === 'dashboard_route_mismatch'
  );
}

async function findAgentQualityPatterns(filters, services) {
  const patterns = await analyzeImprovementPatterns(filters, services);
  return patterns.filter(p =>
    p.type === 'wrong_natural_chat_domain_routing' || p.type === 'handoff_gap'
  );
}

async function findCostEfficiencyPatterns(filters, services) {
  const patterns = await analyzeImprovementPatterns(filters, services);
  return patterns.filter(p =>
    p.type === 'cost_spike' || p.type === 'render_deploy_missing_dependency'
  );
}

async function findUserPreferencePatterns(filters, services) {
  const patterns = await analyzeImprovementPatterns(filters, services);
  return patterns.filter(p =>
    p.type === 'proposal_rejection' || p.type === 'wrong_natural_chat_domain_routing'
  );
}

module.exports = {
  analyzeImprovementPatterns,
  findRepeatedFailures,
  findRegressionPatterns,
  findAgentQualityPatterns,
  findCostEfficiencyPatterns,
  findUserPreferencePatterns
};
