'use strict';

const store = require('./knowledge-graph-store');
const utils = require('./knowledge-utils');

const STALE_AGE_MS = 1000 * 60 * 60 * 24 * 90;

function getAgeMs(item) {
  const ref = item.updatedAt || item.createdAt;
  if (!ref) return 0;
  const t = Date.parse(ref);
  if (Number.isNaN(t)) return 0;
  return Date.now() - t;
}

function detectStaleKnowledge(filters = {}, services = {}) {
  const minAge = parseInt(filters.minAgeMs, 10) || STALE_AGE_MS;
  const list = store.listKnowledgeNodes({ status: 'active', limit: 1000 }, services);
  return list.filter(n => {
    if (utils.isProtectedDecisionTitle(n.title)) return false;
    return getAgeMs(n) > minAge;
  }).map(n => ({ id: n.id, type: n.type, title: n.title, ageMs: getAgeMs(n) }));
}

function detectSupersededDecisions(filters = {}, services = {}) {
  const decisions = store.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 500 }, services);
  const result = [];
  for (const d of decisions) {
    if (utils.isProtectedDecisionTitle(d.title)) continue;
    const superseding = store.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 500 }, services).find(n =>
      n.id !== d.id &&
      (n.title || '').toLowerCase().includes((d.title || '').toLowerCase().slice(0, 10)) &&
      n.source !== d.source
    );
    if (superseding) {
      result.push({ old: d.id, new: superseding.id, oldTitle: d.title, newTitle: superseding.title });
    }
  }
  return result;
}

function suggestArchiveCandidates(filters = {}, services = {}) {
  const stale = detectStaleKnowledge(filters, services);
  const superseded = detectSupersededDecisions(filters, services);
  const supersededIds = new Set(superseded.map(s => s.old));
  const archivePlan = stale
    .filter(s => !supersededIds.has(s.id))
    .filter(s => !utils.isProtectedDecisionTitle(s.title))
    .map(s => ({ id: s.id, reason: 'stale_age', title: s.title, ageMs: s.ageMs }));
  return {
    archivePlan,
    superseded,
    skippedProtected: stale.filter(s => utils.isProtectedDecisionTitle(s.title)).length,
    total: archivePlan.length
  };
}

function createMemoryCleanupPlan(filters = {}, services = {}) {
  const plan = suggestArchiveCandidates(filters, services);
  return {
    plan: plan.archivePlan,
    superseded: plan.superseded,
    requireApproval: true,
    noHardDelete: true,
    reason: 'memory_staleness_review',
    generatedAt: utils.nowIso()
  };
}

function archiveStaleKnowledge(ids = [], services = {}) {
  if (!Array.isArray(ids) || !ids.length) {
    return { ok: false, error: 'NO_IDS', archived: [] };
  }
  const archived = [];
  const skipped = [];
  for (const id of ids) {
    const node = store.getKnowledgeNode(id, services);
    if (!node) { skipped.push({ id, reason: 'NOT_FOUND' }); continue; }
    if (utils.isProtectedDecisionTitle(node.title)) {
      skipped.push({ id, reason: 'PROTECTED_DECISION' });
      continue;
    }
    const res = store.archiveKnowledgeNode(id, 'stale_cleanup', services);
    if (res.ok) archived.push({ id, title: node.title });
    else skipped.push({ id, reason: res.error });
  }
  return { ok: true, archived, skipped, total: ids.length };
}

module.exports = {
  detectStaleKnowledge,
  detectSupersededDecisions,
  suggestArchiveCandidates,
  createMemoryCleanupPlan,
  archiveStaleKnowledge,
  STALE_AGE_MS
};
