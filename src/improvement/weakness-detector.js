'use strict';

const store = require('./improvement-store');
const utils = require('./improvement-utils');

function generateId() {
  return 'weak_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function buildWeakness(data) {
  return {
    id: data.id || generateId(),
    workspaceId: data.workspaceId || 'default',
    title: data.title || 'Untitled Weakness',
    summary: data.summary || '',
    module: data.module || 'unknown',
    severity: data.severity || 'medium',
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
    frequency: Math.max(1, data.frequency || 1),
    firstSeenAt: data.firstSeenAt || new Date().toISOString(),
    lastSeenAt: data.lastSeenAt || new Date().toISOString(),
    status: data.status || 'open'
  };
}

async function detectWeaknessFromFeedback(feedback, services) {
  const weaknesses = [];

  if (!feedback || !feedback.text) return weaknesses;

  const text = feedback.text.toLowerCase();

  if (text.includes('dashboard') && (text.includes('route') || text.includes('tab') || text.includes('missing'))) {
    weaknesses.push(buildWeakness({
      title: 'Dashboard routing issue detected',
      summary: 'Feedback indicates dashboard route or tab problem',
      module: 'dashboard',
      severity: 'high',
      evidence: [feedback.id || 'anonymous', feedback.text],
      workspaceId: feedback.workspaceId
    }));
  }

  if (text.includes('deploy') && (text.includes('fail') || text.includes('error') || text.includes('missing'))) {
    weaknesses.push(buildWeakness({
      title: 'Deploy failure reported',
      summary: 'Feedback indicates a deployment failure',
      module: 'deploy',
      severity: 'high',
      evidence: [feedback.id || 'anonymous', feedback.text],
      workspaceId: feedback.workspaceId
    }));
  }

  if (text.includes('cost') && (text.includes('spike') || text.includes('high') || text.includes('expensive'))) {
    weaknesses.push(buildWeakness({
      title: 'Cost concern reported',
      summary: 'Feedback indicates cost or spending issue',
      module: 'cost',
      severity: 'medium',
      evidence: [feedback.id || 'anonymous', feedback.text],
      workspaceId: feedback.workspaceId
    }));
  }

  if (text.includes('context') && (text.includes('leak') || text.includes('lost') || text.includes('forgot'))) {
    weaknesses.push(buildWeakness({
      title: 'Context leak suspected',
      summary: 'Feedback indicates context was lost or leaked across sessions',
      module: 'conversation',
      severity: 'high',
      evidence: [feedback.id || 'anonymous', feedback.text],
      workspaceId: feedback.workspaceId
    }));
  }

  if (text.includes('proposal') && (text.includes('reject') || text.includes('denied') || text.includes('wrong'))) {
    weaknesses.push(buildWeakness({
      title: 'Proposal rejection feedback',
      summary: 'Feedback indicates a proposal was rejected or incorrect',
      module: 'executor',
      severity: 'medium',
      evidence: [feedback.id || 'anonymous', feedback.text],
      workspaceId: feedback.workspaceId
    }));
  }

  if (text.includes('route') && (text.includes('wrong') || text.includes('incorrect') || text.includes('bad'))) {
    weaknesses.push(buildWeakness({
      title: 'Routing misdirection reported',
      summary: 'Feedback indicates incorrect routing',
      module: 'routing',
      severity: 'high',
      evidence: [feedback.id || 'anonymous', feedback.text],
      workspaceId: feedback.workspaceId
    }));
  }

  for (const w of weaknesses) {
    const existing = store.findSimilarWeakness(w);
    if (existing) {
      existing.frequency += 1;
      existing.lastSeenAt = new Date().toISOString();
      existing.evidence = [...new Set([...existing.evidence, ...w.evidence])];
      store.update(existing);
    } else {
      store.add(w);
    }
  }

  return weaknesses;
}

async function detectWeaknessFromOutcome(outcome, services) {
  const weaknesses = [];

  if (!outcome) return weaknesses;

  if (outcome.success === false) {
    weaknesses.push(buildWeakness({
      title: 'Failed outcome detected',
      summary: outcome.summary || 'An outcome was marked as failed',
      module: outcome.module || 'unknown',
      severity: 'high',
      evidence: [outcome.id || 'anonymous', JSON.stringify(outcome)],
      workspaceId: outcome.workspaceId
    }));
  }

  if (outcome.metrics && outcome.metrics.cost > (outcome.metrics.threshold || 100)) {
    weaknesses.push(buildWeakness({
      title: 'Cost spike from outcome',
      summary: 'Outcome exceeded cost threshold',
      module: 'cost',
      severity: 'medium',
      evidence: [outcome.id || 'anonymous', `cost: ${outcome.metrics.cost}`],
      workspaceId: outcome.workspaceId
    }));
  }

  if (outcome.metrics && outcome.metrics.duration > (outcome.metrics.timeout || 30000)) {
    weaknesses.push(buildWeakness({
      title: 'Outcome timeout exceeded',
      summary: 'Outcome duration exceeded expected timeout',
      module: outcome.module || 'executor',
      severity: 'medium',
      evidence: [outcome.id || 'anonymous', `duration: ${outcome.metrics.duration}`],
      workspaceId: outcome.workspaceId
    }));
  }

  for (const w of weaknesses) {
    const existing = store.findSimilarWeakness(w);
    if (existing) {
      existing.frequency += 1;
      existing.lastSeenAt = new Date().toISOString();
      existing.evidence = [...new Set([...existing.evidence, ...w.evidence])];
      store.update(existing);
    } else {
      store.add(w);
    }
  }

  return weaknesses;
}

async function detectRepeatedDashboardFailure(services) {
  const failures = store.query({ module: 'dashboard', status: 'open' });
  if (failures.length < 2) return [];

  const consolidated = buildWeakness({
    title: 'Repeated dashboard failures',
    summary: `${failures.length} open dashboard weaknesses detected`,
    module: 'dashboard',
    severity: 'high',
    evidence: failures.map(f => f.id),
    frequency: failures.length,
    firstSeenAt: failures[0].firstSeenAt,
    lastSeenAt: failures[failures.length - 1].lastSeenAt
  });

  const existing = store.findSimilarWeakness(consolidated);
  if (existing) {
    store.update({ ...existing, frequency: consolidated.frequency, lastSeenAt: consolidated.lastSeenAt, evidence: consolidated.evidence });
  } else {
    store.add(consolidated);
  }

  return [consolidated];
}

async function detectRepeatedRoutingFailure(services) {
  const failures = store.query({ module: 'routing', status: 'open' });
  if (failures.length < 2) return [];

  const consolidated = buildWeakness({
    title: 'Repeated routing failures',
    summary: `${failures.length} open routing weaknesses detected`,
    module: 'routing',
    severity: 'high',
    evidence: failures.map(f => f.id),
    frequency: failures.length,
    firstSeenAt: failures[0].firstSeenAt,
    lastSeenAt: failures[failures.length - 1].lastSeenAt
  });

  const existing = store.findSimilarWeakness(consolidated);
  if (existing) {
    store.update({ ...existing, frequency: consolidated.frequency, lastSeenAt: consolidated.lastSeenAt, evidence: consolidated.evidence });
  } else {
    store.add(consolidated);
  }

  return [consolidated];
}

async function detectRepeatedDeployFailure(services) {
  const failures = store.query({ module: 'deploy', status: 'open' });
  if (failures.length < 2) return [];

  const consolidated = buildWeakness({
    title: 'Repeated deploy failures',
    summary: `${failures.length} open deploy weaknesses detected`,
    module: 'deploy',
    severity: 'critical',
    evidence: failures.map(f => f.id),
    frequency: failures.length,
    firstSeenAt: failures[0].firstSeenAt,
    lastSeenAt: failures[failures.length - 1].lastSeenAt
  });

  const existing = store.findSimilarWeakness(consolidated);
  if (existing) {
    store.update({ ...existing, frequency: consolidated.frequency, lastSeenAt: consolidated.lastSeenAt, evidence: consolidated.evidence });
  } else {
    store.add(consolidated);
  }

  return [consolidated];
}

async function detectRepeatedCostSpike(services) {
  const spikes = store.query({ module: 'cost', status: 'open' });
  if (spikes.length < 2) return [];

  const consolidated = buildWeakness({
    title: 'Repeated cost spikes',
    summary: `${spikes.length} open cost weaknesses detected`,
    module: 'cost',
    severity: 'high',
    evidence: spikes.map(f => f.id),
    frequency: spikes.length,
    firstSeenAt: spikes[0].firstSeenAt,
    lastSeenAt: spikes[spikes.length - 1].lastSeenAt
  });

  const existing = store.findSimilarWeakness(consolidated);
  if (existing) {
    store.update({ ...existing, frequency: consolidated.frequency, lastSeenAt: consolidated.lastSeenAt, evidence: consolidated.evidence });
  } else {
    store.add(consolidated);
  }

  return [consolidated];
}

async function detectRepeatedProposalRejection(services) {
  const rejections = store.query({ module: 'executor', status: 'open' });
  if (rejections.length < 2) return [];

  const consolidated = buildWeakness({
    title: 'Repeated proposal rejections',
    summary: `${rejections.length} open proposal rejection weaknesses detected`,
    module: 'executor',
    severity: 'medium',
    evidence: rejections.map(f => f.id),
    frequency: rejections.length,
    firstSeenAt: rejections[0].firstSeenAt,
    lastSeenAt: rejections[rejections.length - 1].lastSeenAt
  });

  const existing = store.findSimilarWeakness(consolidated);
  if (existing) {
    store.update({ ...existing, frequency: consolidated.frequency, lastSeenAt: consolidated.lastSeenAt, evidence: consolidated.evidence });
  } else {
    store.add(consolidated);
  }

  return [consolidated];
}

async function detectContextLeakWeakness(services) {
  const leaks = store.query({ module: 'conversation', status: 'open' });
  if (leaks.length < 2) return [];

  const consolidated = buildWeakness({
    title: 'Context leak pattern detected',
    summary: `${leaks.length} open context leak weaknesses detected`,
    module: 'conversation',
    severity: 'critical',
    evidence: leaks.map(f => f.id),
    frequency: leaks.length,
    firstSeenAt: leaks[0].firstSeenAt,
    lastSeenAt: leaks[leaks.length - 1].lastSeenAt
  });

  const existing = store.findSimilarWeakness(consolidated);
  if (existing) {
    store.update({ ...existing, frequency: consolidated.frequency, lastSeenAt: consolidated.lastSeenAt, evidence: consolidated.evidence });
  } else {
    store.add(consolidated);
  }

  return [consolidated];
}

module.exports = {
  detectWeaknessFromFeedback,
  detectWeaknessFromOutcome,
  detectRepeatedDashboardFailure,
  detectRepeatedRoutingFailure,
  detectRepeatedDeployFailure,
  detectRepeatedCostSpike,
  detectRepeatedProposalRejection,
  detectContextLeakWeakness
};
