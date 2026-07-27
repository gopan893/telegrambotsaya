'use strict';

const utils = require('./dr-utils');

const DEFAULT_DRILL_SHAPE = () => ({
  status: 'planned',
  riskLevel: 'low',
  rehearsalOnly: true,
  steps: [],
  findings: [],
  proposalIds: []
});

let drills = [];
let plans = [];
let rehearsals = [];

function createDrill(data) {
  const drill = {
    id: data.id || utils.createId('drill'),
    name: data.name || '',
    scope: data.scope || '',
    status: data.status || DEFAULT_DRILL_SHAPE().status,
    riskLevel: data.riskLevel || DEFAULT_DRILL_SHAPE().riskLevel,
    backupSnapshotId: data.backupSnapshotId || '',
    restoreTarget: data.restoreTarget || '',
    rehearsalOnly: data.rehearsalOnly !== undefined ? data.rehearsalOnly : true,
    steps: Array.isArray(data.steps) ? data.steps : [],
    findings: Array.isArray(data.findings) ? data.findings : [],
    proposalIds: Array.isArray(data.proposalIds) ? data.proposalIds : [],
    createdAt: data.createdAt || utils.nowIso(),
    updatedAt: data.updatedAt || utils.nowIso()
  };
  drills.push(drill);
  return drill;
}

function getDrill(drillId) {
  return drills.find(d => String(d.id) === String(drillId)) || null;
}

function listDrills(filter) {
  let result = drills.slice();
  if (filter) {
    if (filter.scope) result = result.filter(d => d.scope === filter.scope);
    if (filter.status) result = result.filter(d => d.status === filter.status);
    if (filter.riskLevel) result = result.filter(d => d.riskLevel === filter.riskLevel);
  }
  return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function updateDrill(drillId, updates) {
  const idx = drills.findIndex(d => String(d.id) === String(drillId));
  if (idx === -1) return null;
  drills[idx] = { ...drills[idx], ...updates, updatedAt: utils.nowIso() };
  return drills[idx];
}

function removeDrill(drillId) {
  const idx = drills.findIndex(d => String(d.id) === String(drillId));
  if (idx === -1) return false;
  drills.splice(idx, 1);
  return true;
}

function createPlan(scope, data) {
  const plan = {
    id: data.id || utils.createId('plan'),
    scope,
    name: data.name || '',
    status: data.status || 'planned',
    steps: Array.isArray(data.steps) ? data.steps : [],
    envNames: Array.isArray(data.envNames) ? data.envNames : [],
    riskLevel: data.riskLevel || 'medium',
    approvalRequired: data.approvalRequired !== undefined ? data.approvalRequired : true,
    createdAt: data.createdAt || utils.nowIso(),
    updatedAt: data.updatedAt || utils.nowIso()
  };
  plans.push(plan);
  return plan;
}

function getPlan(planId) {
  return plans.find(p => String(p.id) === String(planId)) || null;
}

function listPlans(filter) {
  let result = plans.slice();
  if (filter) {
    if (filter.scope) result = result.filter(p => p.scope === filter.scope);
    if (filter.status) result = result.filter(p => p.status === filter.status);
  }
  return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function recordRehearsal(data) {
  const rehearsal = {
    id: data.id || utils.createId('rehearsal'),
    scope: data.scope || '',
    drillId: data.drillId || '',
    steps: Array.isArray(data.steps) ? data.steps : [],
    result: data.result || 'unknown',
    findings: Array.isArray(data.findings) ? data.findings : [],
    report: data.report || null,
    createdAt: data.createdAt || utils.nowIso()
  };
  rehearsals.push(rehearsal);
  return rehearsal;
}

function getRehearsalLogs(limit) {
  const max = Math.min(Number(limit) || 50, 200);
  return rehearsals.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, max);
}

function resetStore() {
  drills = [];
  plans = [];
  rehearsals = [];
}

function getStats() {
  return {
    drillCount: drills.length,
    planCount: plans.length,
    rehearsalCount: rehearsals.length,
    drillsByStatus: drills.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {}),
    drillsByScope: drills.reduce((acc, d) => { acc[d.scope] = (acc[d.scope] || 0) + 1; return acc; }, {}),
    plansByScope: plans.reduce((acc, p) => { acc[p.scope] = (acc[p.scope] || 0) + 1; return acc; }, {})
  };
}

module.exports = {
  createDrill,
  getDrill,
  listDrills,
  updateDrill,
  removeDrill,
  createPlan,
  getPlan,
  listPlans,
  recordRehearsal,
  getRehearsalLogs,
  resetStore,
  getStats
};
