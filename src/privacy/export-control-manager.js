'use strict';

const crypto = require('crypto');
const EXPORTS = [];

function generateId() { return crypto.createHash('sha1').update(`ex:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16); }

function createExportRequest(input) {
  const req = {
    id: generateId(), workspaceId: input?.workspaceId || 'default', userId: input?.userId || 'unknown',
    categories: input?.categories || [], format: input?.format || 'json',
    includeSensitive: input?.includeSensitive || false, includePrivate: input?.includePrivate || false,
    redactionMode: input?.redactionMode || 'strict', status: 'draft', requiresApproval: false,
    proposalId: null, createdAt: new Date().toISOString()
  };
  if (req.includeSensitive || req.includePrivate || (req.categories.length > 3)) req.requiresApproval = true;
  EXPORTS.push(req); return req;
}

function validateExportRequest(request) {
  const issues = [];
  if (!request.categories || request.categories.length === 0) issues.push('No categories selected');
  if (request.includeSensitive && request.redactionMode === 'none_disallowed') issues.push('Cannot export sensitive data without redaction');
  return { valid: issues.length === 0, issues };
}

function runExportPrivacyReview(request) {
  const blockedCategories = ['secret_blocked'];
  const found = blockedCategories.filter(b => request.categories.includes(b));
  if (found.length > 0) return { blocked: true, reason: `Cannot export blocked categories: ${found.join(', ')}` };
  return { blocked: false, reason: 'Privacy review passed' };
}

function buildExportManifest(request) {
  return { exportId: request.id, categories: request.categories, format: request.format, recordCount: request.categories.length * 10, redactionMode: request.redactionMode, requiresApproval: request.requiresApproval, createdAt: new Date().toISOString() };
}

function createExportProposal(requestId) {
  const req = EXPORTS.find(e => e.id === requestId);
  if (!req) return null;
  const pid = generateId();
  req.status = 'reviewing';
  req.proposalId = pid;
  return { proposalId: pid, exportId: requestId, status: 'pending_approval', message: 'Export requires Evaluation v2 + executor approval' };
}

function markExportReady(requestId) {
  const req = EXPORTS.find(e => e.id === requestId);
  if (!req) return null;
  req.status = 'export_ready';
  return req;
}

function listExports(status) {
  let r = [...EXPORTS];
  if (status) r = r.filter(e => e.status === status);
  return r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { createExportRequest, validateExportRequest, runExportPrivacyReview, buildExportManifest, createExportProposal, markExportReady, listExports };
