'use strict';

const crypto = require('crypto');
const REQUESTS = [];

function generateId() { return crypto.createHash('sha1').update(`dr:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16); }

function createDeleteRequest(input) {
  const req = {
    id: generateId(), workspaceId: input?.workspaceId || 'default', userId: input?.userId || 'unknown',
    categories: input?.categories || [], recordIds: input?.recordIds || [],
    reason: input?.reason || '', softDeleteOnly: input?.softDeleteOnly !== false,
    hardDeleteRequested: input?.hardDeleteRequested === true, riskLevel: input?.hardDeleteRequested ? 'high' : 'low',
    requiresApproval: true, status: 'draft', proposalId: null, createdAt: new Date().toISOString()
  };
  REQUESTS.push(req); return req;
}

function validateDeleteRequest(request) {
  const issues = [];
  if (!request.categories || request.categories.length === 0) issues.push('No categories selected');
  if (request.hardDeleteRequested) issues.push('Hard delete requires special approval');
  return { valid: issues.length === 0, issues };
}

function blockUnsafeHardDelete(request) {
  if (!request.hardDeleteRequested) return { blocked: false, reason: 'Soft delete only' };
  if (request.categories?.includes('audit_logs') || request.categories?.includes('security_findings')) return { blocked: true, reason: 'Hard delete blocked for audit/security data' };
  return { blocked: false, reason: 'Hard delete review passed' };
}

function createDeleteProposal(requestId) {
  const req = REQUESTS.find(r => r.id === requestId);
  if (!req) return null;
  const pid = generateId(); req.status = 'proposal_created'; req.proposalId = pid;
  return { proposalId: pid, deleteRequestId: requestId, status: 'pending_approval' };
}

function executeApprovedSoftDelete(requestId) {
  const req = REQUESTS.find(r => r.id === requestId);
  if (!req) return null;
  if (req.status !== 'approved') return { executed: false, reason: 'Not approved' };
  req.status = 'completed'; return { executed: true, requestId, softDeleted: true };
}

function listRequests(status) {
  let r = [...REQUESTS];
  if (status) r = r.filter(req => req.status === status);
  return r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { createDeleteRequest, validateDeleteRequest, blockUnsafeHardDelete, createDeleteProposal, executeApprovedSoftDelete, listRequests };
