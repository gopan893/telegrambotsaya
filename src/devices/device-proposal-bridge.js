'use strict';

const store = require('./device-store');
const utils = require('./device-utils');

function createProposal(params) {
  if (!params || !params.deviceId || !params.action) {
    return { ok: false, error: 'Missing deviceId or action' };
  }
  const proposal = {
    id: utils.createId('prop'),
    deviceId: params.deviceId,
    action: params.action,
    params: params.params || {},
    riskLevel: params.riskLevel || 'medium',
    status: 'pending',
    createdBy: params.createdBy || 'system',
    reason: params.reason || '',
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };
  store.setProposal(proposal.id, proposal);
  return { ok: true, proposal };
}

function approveProposal(proposalId, approvedBy) {
  const proposal = store.getProposal(proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  if (proposal.status !== 'pending') return { ok: false, error: 'Proposal is not pending' };
  const updated = { ...proposal, status: 'approved', approvedBy: approvedBy || 'system', resolvedAt: new Date().toISOString() };
  store.setProposal(proposalId, updated);
  return { ok: true, proposal: updated };
}

function rejectProposal(proposalId, rejectedBy, reason) {
  const proposal = store.getProposal(proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  const updated = { ...proposal, status: 'rejected', rejectedBy: rejectedBy || 'system', rejectReason: reason || 'rejected', resolvedAt: new Date().toISOString() };
  store.setProposal(proposalId, updated);
  return { ok: true, proposal: updated };
}

function listProposals(filter) {
  return store.listProposals(filter);
}

function getProposal(proposalId) {
  return store.getProposal(proposalId);
}

function summarizeProposal(proposal) {
  if (!proposal) return null;
  return {
    id: proposal.id,
    deviceId: proposal.deviceId,
    action: proposal.action,
    riskLevel: proposal.riskLevel,
    status: proposal.status,
    createdBy: proposal.createdBy,
    createdAt: proposal.createdAt
  };
}

module.exports = {
  createProposal, approveProposal, rejectProposal, listProposals, getProposal, summarizeProposal
};
