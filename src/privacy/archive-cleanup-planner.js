'use strict';

const crypto = require('crypto');
const PLANS = [];

function generateId() { return crypto.createHash('sha1').update(`ac:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16); }

function createArchiveCleanupPlan(input) {
  const plan = {
    id: generateId(), workspaceId: input?.workspaceId || 'default',
    categories: input?.categories || [], candidateCount: input?.candidateCount || 0,
    actions: (input?.categories || []).map(c => ({ category: c, action: 'archive', count: Math.floor(Math.random() * 30) })),
    riskLevel: input?.categories?.length > 3 ? 'medium' : 'low',
    requiresApproval: (input?.categories?.length || 0) > 2,
    proposalId: null, status: 'draft', createdAt: new Date().toISOString()
  };
  PLANS.push(plan); return plan;
}

function findArchiveCandidates(category) {
  return { category, candidates: Math.floor(Math.random() * 50), estimatedSize: 'small', action: 'archive' };
}

function findDuplicatePrivateData() { return [{ type: 'memory', duplicates: 2 }]; }
function findExpiredSessionContext() { return { expiredCount: Math.floor(Math.random() * 20) }; }
function findStaleTemporaryData() { return { staleCount: Math.floor(Math.random() * 15) }; }

function createArchiveProposal(planId) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return null;
  const pid = generateId(); plan.status = 'proposal_created'; plan.proposalId = pid;
  return { proposalId: pid, planId, status: 'pending_approval' };
}

function executeApprovedArchivePlan(planId) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return null;
  if (plan.status !== 'approved') return { executed: false, reason: 'Plan not approved' };
  plan.status = 'done'; return { executed: true, planId };
}

function listPlans(status) {
  let r = [...PLANS];
  if (status) r = r.filter(p => p.status === status);
  return r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { createArchiveCleanupPlan, findArchiveCandidates, findDuplicatePrivateData, findExpiredSessionContext, findStaleTemporaryData, createArchiveProposal, executeApprovedArchivePlan, listPlans };
