'use strict';

let _memory = {};

function _get(key, fallback) {
  if (typeof _memory[key] === 'undefined') _memory[key] = fallback;
  return _memory[key];
}

function _set(key, value) {
  _memory[key] = value;
}

function getReleaseCandidates() { return _get('releaseCandidates', []); }
function addReleaseCandidate(v) { const a = getReleaseCandidates(); a.push(v); _set('releaseCandidates', a); }

function getDeployPlans() { return _get('deployPlans', []); }
function addDeployPlan(v) { const a = getDeployPlans(); a.push(v); _set('deployPlans', a); }

function getDeployProposals() { return _get('deployProposals', []); }
function addDeployProposal(v) { const a = getDeployProposals(); a.push(v); _set('deployProposals', a); }

function getPostDeployReports() { return _get('postDeployReports', []); }
function addPostDeployReport(v) { const a = getPostDeployReports(); a.push(v); _set('postDeployReports', a); }

function getRollbackPlans() { return _get('rollbackPlans', []); }
function addRollbackPlan(v) { const a = getRollbackPlans(); a.push(v); _set('rollbackPlans', a); }

function getRollbackProposals() { return _get('rollbackProposals', []); }
function addRollbackProposal(v) { const a = getRollbackProposals(); a.push(v); _set('rollbackProposals', a); }

function getDeployGates() { return _get('deployGates', []); }
function addDeployGate(v) { const a = getDeployGates(); a.push(v); _set('deployGates', a); }

function getReleaseGates() { return _get('releaseGates', []); }
function addReleaseGate(v) { const a = getReleaseGates(); a.push(v); _set('releaseGates', a); }

function clear() { _memory = {}; }

module.exports = {
  getReleaseCandidates, addReleaseCandidate,
  getDeployPlans, addDeployPlan,
  getDeployProposals, addDeployProposal,
  getPostDeployReports, addPostDeployReport,
  getRollbackPlans, addRollbackPlan,
  getRollbackProposals, addRollbackProposal,
  getDeployGates, addDeployGate,
  getReleaseGates, addReleaseGate,
  clear
};
