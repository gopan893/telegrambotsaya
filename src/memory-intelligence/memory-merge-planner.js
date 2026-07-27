'use strict';

const store = require('./memory-intelligence-store');
const { generateId } = require('./memory-intelligence-utils');

function createMergePlan(memoryA, memoryB, options = {}) {
  if (!memoryA || !memoryB) {
    return { valid: false, warnings: ['invalid_memories'], plan: null };
  }

  const warnings = [];
  const preserveOriginals = options.preserveOriginals !== false;
  const requireApproval = options.requireApproval !== false;

  const mergedContent = mergeContent(memoryA, memoryB);
  const mergedTags = mergeTags(memoryA, memoryB);
  const mergedMetadata = mergeMetadata(memoryA, memoryB);

  const plan = {
    id: generateId('merge'),
    type: 'merge_proposal',
    status: 'proposed',
    memoryA: {
      id: memoryA.id,
      content: memoryA.content,
      tags: memoryA.tags,
      createdAt: memoryA.createdAt
    },
    memoryB: {
      id: memoryB.id,
      content: memoryB.content,
      tags: memoryB.tags,
      createdAt: memoryB.createdAt
    },
    proposedMerge: {
      content: mergedContent,
      tags: mergedTags,
      metadata: mergedMetadata,
      source: `merged_from:${memoryA.id}+${memoryB.id}`
    },
    preserveOriginals,
    requireApproval,
    destructiveAction: false,
    warnings,
    createdAt: new Date().toISOString()
  };

  if (preserveOriginals) {
    plan.postMergeBehavior = 'keep_both_originals';
    warnings.push('originals_will_be_preserved');
  } else {
    plan.postMergeBehavior = 'archive_both_originals';
    warnings.push('originals_will_be_archived_not_deleted');
  }

  store.storeMergeProposal(plan.id, plan);
  return { valid: true, plan, warnings };
}

function mergeContent(memA, memB) {
  const contentA = (memA.content || '').trim();
  const contentB = (memB.content || '').trim();
  if (!contentA) return contentB;
  if (!contentB) return contentA;
  if (contentA === contentB) return contentA;
  return `${contentA}\n\n---\n\n${contentB}`;
}

function mergeTags(memA, memB) {
  const tagsA = Array.isArray(memA.tags) ? memA.tags : [];
  const tagsB = Array.isArray(memB.tags) ? memB.tags : [];
  return [...new Set([...tagsA, ...tagsB])];
}

function mergeMetadata(memA, memB) {
  const metaA = memA.metadata || {};
  const metaB = memB.metadata || {};
  return { ...metaA, ...metaB, mergedFrom: [memA.id, memB.id] };
}

function approveMergePlan(proposalId) {
  const proposal = store.getMergeProposal(proposalId);
  if (!proposal) return { success: false, warning: 'Proposal not found' };
  return store.updateMergeProposal(proposalId, { status: 'approved' });
}

function rejectMergePlan(proposalId) {
  const proposal = store.getMergeProposal(proposalId);
  if (!proposal) return { success: false, warning: 'Proposal not found' };
  return store.updateMergeProposal(proposalId, { status: 'rejected' });
}

function getPendingProposals(userId) {
  return store.listMergeProposals({ status: 'proposed' })
    .filter(p => !userId || p.userId === userId);
}

function summarizeMergePlan(plan) {
  if (!plan) return { summary: 'No plan' };
  const inner = plan.plan || plan;
  if (!inner.memoryA || !inner.memoryB) return { summary: 'No plan' };
  return {
    summary: `Merge "${truncate(inner.memoryA.content)}" + "${truncate(inner.memoryB.content)}" → Proposed. Preserve originals: ${inner.preserveOriginals}. Destructive: ${inner.destructiveAction}.`
  };
}

function truncate(text) {
  if (!text) return '';
  return text.length > 40 ? text.slice(0, 37) + '...' : text;
}

module.exports = {
  createMergePlan,
  mergeContent,
  mergeTags,
  mergeMetadata,
  approveMergePlan,
  rejectMergePlan,
  getPendingProposals,
  summarizeMergePlan
};
