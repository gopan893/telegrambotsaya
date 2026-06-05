'use strict';

const path = require('path');
const fs = require('fs');

let _memoryStore = {
  contract: null,
  handoff: null,
  patchPlans: [],
  changeManifests: [],
  architectureMap: null,
  integrationContract: null,
  collisionReports: [],
  dashboardRouteReports: [],
  backendFrontendReports: [],
  testMatrices: [],
  nextAgentPrompts: []
};

function _getStoreDir(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const dir = path.join(repoRoot, 'scratch', '.devgovernance');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function _filePath(name, services) {
  return path.join(_getStoreDir(services), `${name}.json`);
}

function _readJson(name, services) {
  try {
    const fp = _filePath(name, services);
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function _writeJson(name, data, services) {
  try {
    const fp = _filePath(name, services);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (_) { return false; }
}

function getContract(services) {
  return _memoryStore.contract || _readJson('contract', services);
}

function setContract(data, services) {
  _memoryStore.contract = data;
  _writeJson('contract', data, services);
}

function getHandoff(services) {
  return _memoryStore.handoff || _readJson('handoff', services);
}

function setHandoff(data, services) {
  _memoryStore.handoff = data;
  _writeJson('handoff', data, services);
}

function addPatchPlan(plan, services) {
  _memoryStore.patchPlans.push(plan);
  _writeJson('patchPlans', _memoryStore.patchPlans, services);
}

function updatePatchPlan(planId, update, services) {
  const idx = _memoryStore.patchPlans.findIndex(p => p.id === planId);
  if (idx === -1) return false;
  _memoryStore.patchPlans[idx] = { ..._memoryStore.patchPlans[idx], ...update, updatedAt: new Date().toISOString() };
  _writeJson('patchPlans', _memoryStore.patchPlans, services);
  return true;
}

function getPatchPlans(services) {
  return _memoryStore.patchPlans.length ? _memoryStore.patchPlans : (_readJson('patchPlans', services) || []);
}

function addChangeManifest(manifest, services) {
  _memoryStore.changeManifests.push(manifest);
  _writeJson('changeManifests', _memoryStore.changeManifests, services);
}

function getChangeManifests(services) {
  return _memoryStore.changeManifests.length ? _memoryStore.changeManifests : (_readJson('changeManifests', services) || []);
}

function setArchitectureMap(data, services) {
  _memoryStore.architectureMap = data;
  _writeJson('architectureMap', data, services);
}

function getArchitectureMap(services) {
  return _memoryStore.architectureMap || _readJson('architectureMap', services);
}

function setIntegrationContract(data, services) {
  _memoryStore.integrationContract = data;
  _writeJson('integrationContract', data, services);
}

function getIntegrationContract(services) {
  return _memoryStore.integrationContract || _readJson('integrationContract', services);
}

function addCollisionReport(report, services) {
  _memoryStore.collisionReports.push(report);
  _writeJson('collisionReports', _memoryStore.collisionReports, services);
}

function getCollisionReports(services) {
  return _memoryStore.collisionReports.length ? _memoryStore.collisionReports : (_readJson('collisionReports', services) || []);
}

function setDashboardRouteReport(report, services) {
  _memoryStore.dashboardRouteReports.push(report);
  _writeJson('dashboardRouteReports', _memoryStore.dashboardRouteReports, services);
}

function getDashboardRouteReports(services) {
  return _memoryStore.dashboardRouteReports.length ? _memoryStore.dashboardRouteReports : (_readJson('dashboardRouteReports', services) || []);
}

function setBackendFrontendReport(report, services) {
  _memoryStore.backendFrontendReports.push(report);
  _writeJson('backendFrontendReports', _memoryStore.backendFrontendReports, services);
}

function getBackendFrontendReports(services) {
  return _memoryStore.backendFrontendReports.length ? _memoryStore.backendFrontendReports : (_readJson('backendFrontendReports', services) || []);
}

function addTestMatrix(matrix, services) {
  _memoryStore.testMatrices.push(matrix);
  _writeJson('testMatrices', _memoryStore.testMatrices, services);
}

function getTestMatrices(services) {
  return _memoryStore.testMatrices.length ? _memoryStore.testMatrices : (_readJson('testMatrices', services) || []);
}

function addNextAgentPrompt(prompt, services) {
  _memoryStore.nextAgentPrompts.push(prompt);
  _writeJson('nextAgentPrompts', _memoryStore.nextAgentPrompts, services);
}

function getNextAgentPrompts(services) {
  return _memoryStore.nextAgentPrompts.length ? _memoryStore.nextAgentPrompts : (_readJson('nextAgentPrompts', services) || []);
}

module.exports = {
  getContract, setContract,
  getHandoff, setHandoff,
  addPatchPlan, updatePatchPlan, getPatchPlans,
  addChangeManifest, getChangeManifests,
  setArchitectureMap, getArchitectureMap,
  setIntegrationContract, getIntegrationContract,
  addCollisionReport, getCollisionReports,
  setDashboardRouteReport, getDashboardRouteReports,
  setBackendFrontendReport, getBackendFrontendReports,
  addTestMatrix, getTestMatrices,
  addNextAgentPrompt, getNextAgentPrompts
};
