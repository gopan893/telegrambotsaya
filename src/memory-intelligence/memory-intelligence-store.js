'use strict';

const memoryEntries = new Map();
const duplicatePairs = new Map();
const mergeProposals = new Map();
const conflictRecords = new Map();
const sensitivityClassifications = new Map();

function addMemoryEntry(entry) {
  const id = entry.id || `mi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    userId: entry.userId || 'unknown',
    content: entry.content || '',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    source: entry.source || 'manual',
    sensitivity: entry.sensitivity || 'unknown',
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: entry.lastAccessedAt || new Date().toISOString(),
    accessCount: entry.accessCount || 0,
    metadata: entry.metadata || {}
  };
  memoryEntries.set(id, record);
  return record;
}

function getMemoryEntry(entryId) {
  return memoryEntries.get(String(entryId)) || null;
}

function updateMemoryEntry(entryId, updates) {
  const existing = memoryEntries.get(String(entryId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: entryId, updatedAt: new Date().toISOString() };
  memoryEntries.set(entryId, updated);
  return updated;
}

function removeMemoryEntry(entryId) {
  return memoryEntries.delete(String(entryId));
}

function listMemoryEntries(filter = {}) {
  let arr = Array.from(memoryEntries.values());
  if (filter.userId) arr = arr.filter(e => e.userId === filter.userId);
  if (filter.sensitivity) arr = arr.filter(e => e.sensitivity === filter.sensitivity);
  if (filter.source) arr = arr.filter(e => e.source === filter.source);
  if (filter.tag) arr = arr.filter(e => e.tags.includes(filter.tag));
  if (filter.query) {
    const q = filter.query.toLowerCase();
    arr = arr.filter(e => e.content.toLowerCase().includes(q));
  }
  return arr;
}

function getMemoryEntryCount() {
  return memoryEntries.size;
}

function storeDuplicatePair(pairId, pair) {
  duplicatePairs.set(String(pairId), {
    id: pairId,
    ...pair,
    createdAt: new Date().toISOString()
  });
}

function getDuplicatePair(pairId) {
  return duplicatePairs.get(String(pairId)) || null;
}

function listDuplicatePairs(filter = {}) {
  let arr = Array.from(duplicatePairs.values());
  if (filter.userId) arr = arr.filter(p => p.userId === filter.userId);
  if (filter.status) arr = arr.filter(p => p.status === filter.status);
  return arr;
}

function storeMergeProposal(proposalId, proposal) {
  mergeProposals.set(String(proposalId), {
    id: proposalId,
    ...proposal,
    status: 'proposed',
    createdAt: new Date().toISOString()
  });
}

function getMergeProposal(proposalId) {
  return mergeProposals.get(String(proposalId)) || null;
}

function listMergeProposals(filter = {}) {
  let arr = Array.from(mergeProposals.values());
  if (filter.status) arr = arr.filter(p => p.status === filter.status);
  if (filter.userId) arr = arr.filter(p => p.userId === filter.userId);
  return arr;
}

function updateMergeProposal(proposalId, updates) {
  const existing = mergeProposals.get(String(proposalId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  mergeProposals.set(proposalId, updated);
  return updated;
}

function storeConflictRecord(conflictId, record) {
  conflictRecords.set(String(conflictId), {
    id: conflictId,
    ...record,
    createdAt: new Date().toISOString()
  });
}

function getConflictRecord(conflictId) {
  return conflictRecords.get(String(conflictId)) || null;
}

function listConflictRecords(filter = {}) {
  let arr = Array.from(conflictRecords.values());
  if (filter.userId) arr = arr.filter(r => r.userId === filter.userId);
  if (filter.resolved !== undefined) arr = arr.filter(r => r.resolved === filter.resolved);
  return arr;
}

function storeSensitivityClassification(memoryId, classification) {
  sensitivityClassifications.set(String(memoryId), {
    memoryId,
    ...classification,
    classifiedAt: new Date().toISOString()
  });
}

function getSensitivityClassification(memoryId) {
  return sensitivityClassifications.get(String(memoryId)) || null;
}

function resetStore() {
  memoryEntries.clear();
  duplicatePairs.clear();
  mergeProposals.clear();
  conflictRecords.clear();
  sensitivityClassifications.clear();
}

module.exports = {
  addMemoryEntry,
  getMemoryEntry,
  updateMemoryEntry,
  removeMemoryEntry,
  listMemoryEntries,
  getMemoryEntryCount,
  storeDuplicatePair,
  getDuplicatePair,
  listDuplicatePairs,
  storeMergeProposal,
  getMergeProposal,
  listMergeProposals,
  updateMergeProposal,
  storeConflictRecord,
  getConflictRecord,
  listConflictRecords,
  storeSensitivityClassification,
  getSensitivityClassification,
  resetStore
};
