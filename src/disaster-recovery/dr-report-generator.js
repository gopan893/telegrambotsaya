'use strict';

const store = require('./dr-store');
const utils = require('./dr-utils');

async function generateDrReport(services) {
  const drills = store.listDrills({});
  const plans = store.listPlans({});
  const rehearsals = store.getRehearsalLogs(100);
  const stats = store.getStats();

  let readiness = {};
  try {
    const readinessGate = require('./recovery-readiness-gate');
    readiness = await readinessGate.runRecoveryReadinessGate(services);
  } catch (_) {
    readiness = { ok: false, gateResult: 'unknown', error: 'Readiness gate module unavailable' };
  }

  return utils.sanitizeDrData({
    ok: true,
    summary: {
      totalDrills: drills.length,
      totalPlans: plans.length,
      totalRehearsals: rehearsals.length,
      activeDrills: drills.filter(d => d.status !== 'completed' && d.status !== 'failed').length,
      completedDrills: drills.filter(d => d.status === 'completed').length
    },
    drills: drills.map(d => ({
      id: d.id, name: d.name, scope: d.scope,
      status: d.status, riskLevel: d.riskLevel,
      stepCount: d.steps.length, findingsCount: d.findings.length,
      createdAt: d.createdAt, updatedAt: d.updatedAt
    })),
    plans: plans.map(p => ({
      id: p.id, scope: p.scope, name: p.name,
      status: p.status, envNames: p.envNames,
      riskLevel: p.riskLevel, approvalRequired: p.approvalRequired,
      createdAt: p.createdAt
    })),
    rehearsals: rehearsals.map(r => ({
      id: r.id, scope: r.scope, result: r.result,
      stepCount: r.steps.length, createdAt: r.createdAt
    })),
    readiness: readiness.ok ? {
      gateResult: readiness.gateResult,
      blockers: readiness.blockers || []
    } : { gateResult: 'unknown' },
    stats,
    generatedAt: utils.nowIso()
  });
}

async function generateDrSummary(services) {
  const report = await generateDrReport(services);
  if (!report.ok) return { ok: false, error: 'DR report generation failed' };

  const summary = report.summary;
  const readinessGate = report.readiness.gateResult || 'unknown';

  return utils.sanitizeDrData({
    ok: true,
    summary: `DR Summary: ${summary.activeDrills} active drills, ${summary.completedDrills} completed, ${summary.totalPlans} plans, ${summary.totalRehearsals} rehearsals. Readiness: ${readinessGate}.`,
    stats: summary,
    readiness: report.readiness,
    generatedAt: report.generatedAt
  });
}

module.exports = {
  generateDrReport,
  generateDrSummary
};
