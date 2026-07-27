'use strict';

function nowIso() {
  return new Date().toISOString();
}

function generateSnapshotId() {
  return 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

async function buildOperatingSnapshot(systemState, services = {}) {
  const modules = {};
  const concerns = [];
  const opportunities = [];
  let healthStatus = 'healthy';
  let pendingApprovals = 0;

  const state = systemState || {};

  if (state.modules) {
    for (const [name, data] of Object.entries(state.modules)) {
      modules[name] = data;
      if (data.errors && data.errors.length > 0) healthStatus = 'critical';
      if (data.blockers && data.blockers.length > 0) healthStatus = 'critical';
      if (data.status === 'degraded' && healthStatus !== 'critical') healthStatus = 'degraded';
      if (data.pendingApprovals) pendingApprovals += data.pendingApprovals;
    }
  }

  if (state.pendingApprovals > 0) {
    pendingApprovals += state.pendingApprovals;
    if (healthStatus !== 'critical' && healthStatus !== 'degraded') healthStatus = 'warning';
  }

  if (state.staleTasks && state.staleTasks.length > 0) {
    if (healthStatus !== 'critical' && healthStatus !== 'degraded') healthStatus = 'warning';
  }

  if (state.concerns && Array.isArray(state.concerns)) {
    concerns.push(...state.concerns.slice(0, 5));
  }

  if (state.opportunities && Array.isArray(state.opportunities)) {
    opportunities.push(...state.opportunities.slice(0, 3));
  }

  if (!healthStatus) healthStatus = 'unknown';

  const snapshot = {
    id: generateSnapshotId(),
    workspaceId: state.workspaceId || '',
    healthStatus,
    summary: '',
    modules,
    concerns,
    opportunities,
    pendingApprovals,
    recommendedActions: state.recommendedActions || [],
    createdAt: nowIso()
  };

  snapshot.summary = await summarizeOperatingSnapshot(snapshot, services);

  return snapshot;
}

async function summarizeOperatingSnapshot(snapshot, services = {}) {
  if (!snapshot) return 'No snapshot available.';
  const moduleCount = Object.keys(snapshot.modules || {}).length;
  const health = snapshot.healthStatus || 'unknown';
  const concerns = (snapshot.concerns || []).length;
  const opportunities = (snapshot.opportunities || []).length;
  const pending = snapshot.pendingApprovals || 0;

  let summary = `System snapshot shows ${moduleCount} module(s) with health status "${health}".`;
  if (concerns > 0) summary += ` ${concerns} concern(s) identified.`;
  if (opportunities > 0) summary += ` ${opportunities} opportunity(ies) found.`;
  if (pending > 0) summary += ` ${pending} pending approval(s) require attention.`;

  return summary;
}

function classifySnapshotHealth(snapshot, services = {}) {
  if (!snapshot) return 'unknown';
  const modules = snapshot.modules || {};

  for (const data of Object.values(modules)) {
    if (data.errors && data.errors.length > 0) return 'critical';
    if (data.blockers && data.blockers.length > 0) return 'critical';
  }

  for (const data of Object.values(modules)) {
    if (data.status === 'degraded') return 'degraded';
  }

  if (snapshot.pendingApprovals > 0) return 'warning';
  if ((snapshot.concerns || []).some(c => String(c).toLowerCase().includes('stale'))) return 'warning';

  return 'healthy';
}

function extractTopConcerns(snapshot, services = {}) {
  const concerns = [];

  if (!snapshot) return concerns;

  const modules = snapshot.modules || {};

  for (const [name, data] of Object.entries(modules)) {
    if (data.errors && data.errors.length > 0) {
      for (const err of data.errors.slice(0, 2)) {
        concerns.push(`[${name}] Error: ${String(err).slice(0, 120)}`);
      }
    }
    if (data.blockers && data.blockers.length > 0) {
      for (const blocker of data.blockers.slice(0, 2)) {
        concerns.push(`[${name}] Blocker: ${String(blocker.title || blocker).slice(0, 120)}`);
      }
    }
    if (data.status === 'degraded') {
      concerns.push(`[${name}] Module is degraded`);
    }
  }

  if (snapshot.pendingApprovals > 0) {
    concerns.push(`${snapshot.pendingApprovals} pending approval(s) need review`);
  }

  if (snapshot.concerns && Array.isArray(snapshot.concerns)) {
    for (const c of snapshot.concerns) {
      if (!concerns.includes(c)) concerns.push(c);
    }
  }

  return concerns.slice(0, 5);
}

function extractTopOpportunities(snapshot, services = {}) {
  const opportunities = [];

  if (!snapshot) return opportunities;

  if (snapshot.opportunities && Array.isArray(snapshot.opportunities)) {
    opportunities.push(...snapshot.opportunities);
  }

  const modules = snapshot.modules || {};
  for (const [name, data] of Object.entries(modules)) {
    if (data.opportunities && Array.isArray(data.opportunities)) {
      for (const opp of data.opportunities) {
        opportunities.push(`[${name}] ${String(opp).slice(0, 120)}`);
      }
    }
  }

  if (snapshot.healthStatus === 'healthy' && Object.keys(modules).length > 0) {
    opportunities.push('All modules are healthy — ideal time for strategic improvements');
  }

  return opportunities.slice(0, 3);
}

module.exports = {
  buildOperatingSnapshot,
  summarizeOperatingSnapshot,
  classifySnapshotHealth,
  extractTopConcerns,
  extractTopOpportunities
};
