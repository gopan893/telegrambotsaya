'use strict';

const store = require('./knowledge-graph-store');
const nodeManager = require('./knowledge-node-manager');
const utils = require('./knowledge-utils');

function normalizeForCompare(input = {}) {
  const title = String(input.title || '').trim().toLowerCase();
  const summary = String(input.summary || '').trim().toLowerCase();
  return {
    type: String(input.type || '').toLowerCase(),
    title,
    summaryKey: summary.slice(0, 120),
    tags: (input.tags || []).map(t => String(t).toLowerCase()).sort(),
    source: String(input.source || '').toLowerCase(),
    sourceId: String(input.sourceId || '').trim().toLowerCase()
  };
}

function findDuplicateKnowledge(candidate = {}, services = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return { duplicates: [], exact: null };
  }
  const norm = normalizeForCompare(candidate);
  if (!norm.type || !norm.title) {
    return { duplicates: [], exact: null };
  }
  const candidates = store.listKnowledgeNodes({ type: norm.type, status: 'active', limit: 500 }, services);
  const exact = candidates.find(n =>
    String(n.title || '').trim().toLowerCase() === norm.title &&
    String(n.sourceId || '').trim().toLowerCase() === norm.sourceId
  ) || null;
  const near = candidates.filter(n => {
    const nTitle = String(n.title || '').trim().toLowerCase();
    if (nTitle === norm.title) return false;
    const sameSource = String(n.source || '').toLowerCase() === norm.source;
    const sameSourceId = String(n.sourceId || '').trim().toLowerCase() === norm.sourceId && norm.sourceId;
    const similarTitle = nTitle.includes(norm.title) || norm.title.includes(nTitle);
    return sameSourceId || (sameSource && similarTitle);
  });
  return { duplicates: near, exact };
}

function mergeDuplicateKnowledge(existingId, candidate = {}, services = {}) {
  const existing = store.getKnowledgeNode(existingId, services);
  if (!existing) return { ok: false, error: 'NODE_NOT_FOUND' };
  if (utils.isProtectedDecisionTitle(existing.title)) {
    return { ok: false, error: 'PROTECTED_DECISION' };
  }
  if (candidate.title && candidate.title !== existing.title) {
    return { ok: false, error: 'TITLE_MISMATCH' };
  }
  const merged = {
    summary: candidate.summary || existing.summary,
    tags: Array.from(new Set([...(existing.tags || []), ...((candidate.tags || []).map(t => String(t)))])).slice(0, 20),
    confidence: Math.max(existing.confidence || 0, candidate.confidence || 0)
  };
  return store.updateKnowledgeNode(existingId, merged, services);
}

function detectConflictingKnowledge(candidate = {}, services = {}) {
  if (!candidate || typeof candidate !== 'object') return [];
  const norm = normalizeForCompare(candidate);
  if (!norm.type) return [];
  const candidates = store.listKnowledgeNodes({ type: norm.type, status: 'active', limit: 500 }, services);
  return candidates.filter(n => {
    const sameArea = String(n.title || '').trim().toLowerCase().includes(norm.title.slice(0, 12)) ||
                     norm.title.includes(String(n.title || '').trim().toLowerCase().slice(0, 12));
    if (!sameArea) return false;
    return String(n.summary || '').trim() !== String(candidate.summary || '').trim() && n.source !== candidate.source;
  }).slice(0, 10);
}

function buildDeduplicationReport(candidate = {}, services = {}) {
  const dup = findDuplicateKnowledge(candidate, services);
  const conflicts = detectConflictingKnowledge(candidate, services);
  return {
    isDuplicate: !!dup.exact,
    exactMatch: dup.exact ? { id: dup.exact.id, title: dup.exact.title, source: dup.exact.source } : null,
    nearDuplicates: dup.duplicates.map(d => ({ id: d.id, title: d.title, source: d.source })),
    conflictCount: conflicts.length,
    conflicts: conflicts.map(c => ({ id: c.id, title: c.title, source: c.source })),
    recommendation: dup.exact ? 'merge' : (conflicts.length ? 'flag_conflict' : 'store'),
    generatedAt: utils.nowIso()
  };
}

function safeDeduplicateStore(candidate, createFn, services = {}) {
  const report = buildDeduplicationReport(candidate, services);
  if (report.isDuplicate && report.exactMatch) {
    return { ok: true, deduplicated: true, existing: report.exactMatch, report };
  }
  if (report.conflictCount > 0 && !candidate.allowConflict) {
    return { ok: false, conflict: true, conflicts: report.conflicts, report };
  }
  const created = createFn(candidate, services);
  return { ok: created.ok, node: created.node || null, error: created.error || null, report };
}

module.exports = {
  normalizeForCompare,
  findDuplicateKnowledge,
  mergeDuplicateKnowledge,
  detectConflictingKnowledge,
  buildDeduplicationReport,
  safeDeduplicateStore
};
