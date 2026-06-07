'use strict';

const store = require('./operating-loop-store');
const collector = require('./system-state-collector');
const snapshotBuilder = require('./operating-snapshot-builder');
const blockerDetector = require('./blocker-detector');
const synthesizer = require('./next-action-synthesizer');
const utils = require('./operating-loop-utils');

let reportCounter = 0;

function generateReportId(type) {
  const ts = Date.now().toString(36);
  const seq = (++reportCounter).toString(36);
  return `report_${type}_${ts}_${seq}`;
}

function buildBaseReport(type, workspaceId, overrides = {}) {
  return {
    id: generateReportId(type),
    type,
    workspaceId: workspaceId || 'unknown',
    healthStatus: 'healthy',
    summary: '',
    topBlockers: [],
    topNextAction: null,
    pendingApprovals: [],
    openIncidents: [],
    costStatus: {},
    portfolioPriority: '',
    lifeOSPriority: '',
    knowledgeWarnings: [],
    recommendedAgent: '',
    createdAt: typeof utils.nowIso === 'function' ? utils.nowIso() : new Date().toISOString(),
    ...overrides
  };
}

async function generateDailyAIOSReport(workspaceId, services = {}) {
  try {
    const state = await collector.collectSystemState(workspaceId, { ...services, reportType: 'daily' });
    const snapshot = await snapshotBuilder.buildOperatingSnapshot(state, { ...services, reportType: 'daily' });
    const blockers = await blockerDetector.detectOperatingBlockers(state, snapshot, { ...services, reportType: 'daily' });
    const actions = await synthesizer.synthesizeNextActions(snapshot, blockers, { ...services, reportType: 'daily' });

    const healthStatus = determineHealthStatus(blockers);
    const topNextAction = (actions || [])[0] || null;
    const recommendedAgent = topNextAction?.agent || topNextAction?.recommendedAgent || '';

    const report = buildBaseReport('daily', workspaceId, {
      healthStatus,
      summary: buildDailySummary(snapshot, actions, blockers),
      topBlockers: (blockers || []).slice(0, 5),
      topNextAction,
      pendingApprovals: extractPendingApprovals(snapshot),
      openIncidents: extractIncidents(state),
      costStatus: extractCostStatus(state),
      recommendedAgent
    });

    return report;
  } catch (err) {
    return buildBaseReport('daily', workspaceId, {
      healthStatus: 'unknown',
      summary: `Report generation failed: ${err.message}`,
      knowledgeWarnings: [`Error: ${err.message}`]
    });
  }
}

async function generateWeeklyAIOSReport(workspaceId, services = {}) {
  try {
    const state = await collector.collectSystemState(workspaceId, { ...services, reportType: 'weekly' });
    const snapshot = await snapshotBuilder.buildOperatingSnapshot(state, { ...services, reportType: 'weekly' });
    const blockers = await blockerDetector.detectOperatingBlockers(state, snapshot, { ...services, reportType: 'weekly' });
    const actions = await synthesizer.synthesizeNextActions(snapshot, blockers, { ...services, reportType: 'weekly' });

    const healthStatus = determineHealthStatus(blockers);
    const topNextAction = (actions || [])[0] || null;
    const recommendedAgent = topNextAction?.agent || topNextAction?.recommendedAgent || '';

    const report = buildBaseReport('weekly', workspaceId, {
      healthStatus,
      summary: buildWeeklySummary(snapshot, actions, blockers),
      topBlockers: (blockers || []).slice(0, 10),
      topNextAction,
      pendingApprovals: extractPendingApprovals(snapshot),
      openIncidents: extractIncidents(state),
      costStatus: extractCostStatus(state),
      recommendedAgent
    });

    return report;
  } catch (err) {
    return buildBaseReport('weekly', workspaceId, {
      healthStatus: 'unknown',
      summary: `Weekly report generation failed: ${err.message}`,
      knowledgeWarnings: [`Error: ${err.message}`]
    });
  }
}

async function generateSystemReadinessReport(workspaceId, services = {}) {
  try {
    const state = await collector.collectSystemState(workspaceId, { ...services, reportType: 'readiness' });
    const blockers = await blockerDetector.detectOperatingBlockers(state, null, { ...services, reportType: 'readiness' });

    const warnings = [];
    const criticalBlockers = (blockers || []).filter(b => b.severity === 'critical' || b.critical);
    const nonCriticalBlockers = (blockers || []).filter(b => b.severity !== 'critical' && !b.critical);
    const isReady = criticalBlockers.length === 0;

    if (criticalBlockers.length > 0) {
      warnings.push(`${criticalBlockers.length} critical blocker(s) present`);
    }
    if (nonCriticalBlockers.length > 0) {
      warnings.push(`${nonCriticalBlockers.length} non-critical blocker(s) present`);
    }

    const costOk = state?.costStatus?.budgetExceeded !== true;
    if (!costOk) {
      warnings.push('Budget exceeded');
    }

    const report = buildBaseReport('readiness', workspaceId, {
      healthStatus: isReady ? (warnings.length > 0 ? 'warning' : 'healthy') : 'critical',
      summary: isReady ? 'System is ready for operation.' : 'System is not ready. Resolve blockers first.',
      topBlockers: (blockers || []).slice(0, 10),
      knowledgeWarnings: warnings,
      costStatus: extractCostStatus(state)
    });

    return report;
  } catch (err) {
    return buildBaseReport('readiness', workspaceId, {
      healthStatus: 'unknown',
      summary: `Readiness check failed: ${err.message}`,
      knowledgeWarnings: [`Error: ${err.message}`]
    });
  }
}

async function generateApprovalDigest(workspaceId, services = {}) {
  try {
    const pendingProposals = store.listProposals ? store.listProposals({ workspaceId, status: 'pending_approval' }) : [];

    const report = buildBaseReport('approval_digest', workspaceId, {
      healthStatus: 'healthy',
      summary: `${pendingProposals.length} proposal(s) pending approval.`,
      pendingApprovals: pendingProposals.slice(0, 50)
    });

    return report;
  } catch (err) {
    return buildBaseReport('approval_digest', workspaceId, {
      healthStatus: 'unknown',
      summary: `Approval digest failed: ${err.message}`,
      knowledgeWarnings: [`Error: ${err.message}`]
    });
  }
}

function determineHealthStatus(blockers) {
  if (!blockers || blockers.length === 0) return 'healthy';
  const hasCritical = blockers.some(b => b.severity === 'critical' || b.critical || b.blocked === true);
  if (hasCritical) return 'critical';
  return 'warning';
}

function buildDailySummary(snapshot, actions, blockers) {
  const parts = [];
  const health = snapshot?.healthStatus || 'unknown';
  parts.push(`Health: ${health}`);
  parts.push(`Blockers: ${(blockers || []).length}`);
  parts.push(`Actions: ${(actions || []).length}`);
  if (snapshot?.summary) parts.push(snapshot.summary);
  return parts.join(' | ');
}

function buildWeeklySummary(snapshot, actions, blockers) {
  const parts = [];
  const health = snapshot?.healthStatus || 'unknown';
  parts.push(`Weekly Health: ${health}`);
  parts.push(`Total Blockers: ${(blockers || []).length}`);
  parts.push(`Recommended Actions: ${(actions || []).length}`);
  if (snapshot?.summary) parts.push(snapshot.summary);
  return parts.join(' | ');
}

function extractPendingApprovals(snapshot) {
  if (!snapshot) return [];
  return snapshot.pendingApprovals || snapshot.pendingProposals || [];
}

function extractIncidents(state) {
  if (!state) return [];
  return state.incidents || state.openIncidents || [];
}

function extractCostStatus(state) {
  if (!state) return {};
  return state.costStatus || state.cost || {};
}

module.exports = {
  generateDailyAIOSReport,
  generateWeeklyAIOSReport,
  generateSystemReadinessReport,
  generateApprovalDigest
};
