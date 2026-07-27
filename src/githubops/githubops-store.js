'use strict';

const utils = require('./githubops-utils');

let _memory = {};

function _get(key, fallback) {
  if (typeof _memory[key] === 'undefined') _memory[key] = fallback;
  return _memory[key];
}

function _set(key, value) {
  _memory[key] = value;
}

function getRepoState() { return _get('repoState', null); }
function setRepoState(v) { _set('repoState', v); }

function getChangeManifest() { return _get('changeManifest', null); }
function setChangeManifest(v) { _set('changeManifest', v); }

function getSecretScan() { return _get('secretScan', null); }
function setSecretScan(v) { _set('secretScan', v); }

function getCommitPlans() { return _get('commitPlans', []); }
function addCommitPlan(v) { const a = getCommitPlans(); a.push(v); _set('commitPlans', a); }

function getPushPlans() { return _get('pushPlans', []); }
function addPushPlan(v) { const a = getPushPlans(); a.push(v); _set('pushPlans', a); }
function setPushPlan(v) { _set('pushPlans', v ? [v] : []); }

function getPushProposals() { return _get('pushProposals', []); }
function addPushProposal(v) { const a = getPushProposals(); a.push(v); _set('pushProposals', a); }

function getWorkflowRunPlans() { return _get('workflowRunPlans', []); }
function addWorkflowRunPlan(v) { const a = getWorkflowRunPlans(); a.push(v); _set('workflowRunPlans', a); }

function getWorkflowRunProposals() { return _get('workflowRunProposals', []); }
function addWorkflowRunProposal(v) { const a = getWorkflowRunProposals(); a.push(v); _set('workflowRunProposals', a); }

function getReleaseGates() { return _get('releaseGates', []); }
function addReleaseGate(v) { const a = getReleaseGates(); a.push(v); _set('releaseGates', a); }

function clear() { _memory = {}; }

module.exports = {
  getRepoState, setRepoState,
  getChangeManifest, setChangeManifest,
  getSecretScan, setSecretScan,
  getCommitPlans, addCommitPlan,
  getPushPlans, addPushPlan, setPushPlan,
  getPushProposals, addPushProposal,
  getWorkflowRunPlans, addWorkflowRunPlan,
  getWorkflowRunProposals, addWorkflowRunProposal,
  getReleaseGates, addReleaseGate,
  clear
};
