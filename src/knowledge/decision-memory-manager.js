'use strict';

const store = require('./knowledge-graph-store');
const safetyGate = require('./memory-safety-gate');
const dedup = require('./memory-deduplicator');
const utils = require('./knowledge-utils');

const CORE_DECISIONS = [
  { title: 'Use Node.js 20', summary: 'Runtime pinned to Node.js 20 LTS for stable CommonJS support.', tags: ['runtime', 'core'] },
  { title: 'Use CommonJS only', summary: 'All modules use require/module.exports. No ESM or TypeScript.', tags: ['module-system', 'core'] },
  { title: 'Use vanilla dashboard', summary: 'Dashboard uses vanilla HTML/CSS/JS only. No React, Next, or Vue.', tags: ['dashboard', 'core'] },
  { title: 'No TypeScript', summary: 'TypeScript is not allowed in this project.', tags: ['language', 'core'] },
  { title: 'No React/Next/Vue', summary: 'No React, Next.js, or Vue.js allowed. Vanilla dashboard only.', tags: ['dashboard', 'core'] },
  { title: 'Approval required for write/external/danger', summary: 'Write, external, and danger actions must follow: dry-run → Evaluation v2 → executor proposal → approval → run.', tags: ['approval', 'core'] },
  { title: 'GitHub push requires proposal and approval', summary: 'No direct git push from runtime. Must use executor proposal and approval flow.', tags: ['githubops', 'approval', 'core'] },
  { title: 'Render deploy/rollback requires proposal and approval', summary: 'No direct Render deploy or rollback. Proposal + approval required.', tags: ['deploy', 'approval', 'core'] },
  { title: 'Gmail send disabled unless strict approval', summary: 'Gmail send requires explicit strict approval flow.', tags: ['integrations', 'approval', 'core'] },
  { title: 'Optional env must not crash app', summary: 'Optional environment variables (e.g. REDIS) must not break boot.', tags: ['resilience', 'core'] },
  { title: 'Dashboard known tabs must not fallback to Overview', summary: 'Known dashboard tabs must render their own page. Unknown tabs may fallback to Overview.', tags: ['dashboard', 'core'] },
  { title: 'Secrets must not be logged or stored', summary: 'No tokens, API keys, passwords, or env values may be logged or stored in memory/graph.', tags: ['security', 'core'] },
  { title: 'No shell executor', summary: 'No shell/SSH/Termux executor is allowed in the runtime.', tags: ['security', 'core'] },
  { title: 'No autonomous repo mutation', summary: 'Bot runtime cannot mutate the repository directly.', tags: ['security', 'core'] },
  { title: 'No hard delete memory without archive', summary: 'Memory entries must be archived, not hard deleted, for safety.', tags: ['memory', 'core'] }
];

function recordDecisionMemory(decision = {}, services = {}) {
  if (!decision || typeof decision !== 'object') {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  const title = utils.safeStr(decision.title || '', 200);
  if (!title) return { ok: false, error: 'TITLE_REQUIRED' };
  const candidate = {
    type: 'decision',
    title,
    summary: utils.safeStr(decision.summary || '', 1000),
    tags: ['decision', ...((decision.tags || []).map(t => String(t)))].slice(0, 20),
    source: decision.source || 'decision_memory',
    sourceId: decision.sourceId || `decision-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
    sensitivity: decision.sensitivity || 'internal',
    confidence: Number.isFinite(decision.confidence) ? decision.confidence : 0.9
  };
  const gate = safetyGate.runMemorySafetyGate(candidate, services);
  if (!gate.ok) {
    return { ok: false, error: gate.reason, safeSummary: gate.safeSummary, report: gate.report };
  }
  const dedupe = dedup.buildDeduplicationReport(candidate, services);
  if (dedupe.isDuplicate && dedupe.exactMatch) {
    return { ok: true, deduplicated: true, existing: dedupe.exactMatch, report: dedupe };
  }
  const created = store.createKnowledgeNode(candidate, services);
  if (!created.ok) return { ok: false, error: created.error };
  return { ok: true, decision: created.node, deduplicated: false };
}

function searchDecisionMemory(query = '', services = {}) {
  const decisions = store.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 500 }, services);
  if (!query) return decisions;
  const q = String(query).toLowerCase();
  return decisions.filter(d =>
    (d.title || '').toLowerCase().includes(q) ||
    (d.summary || '').toLowerCase().includes(q) ||
    (d.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

function linkDecisionToProject(decisionId, projectId, services = {}) {
  return store.createKnowledgeEdge({
    fromNodeId: decisionId,
    toNodeId: projectId,
    relation: 'relates_to',
    source: 'decision_memory',
    evidence: 'decision-to-project link'
  }, services);
}

function linkDecisionToPhase(decisionId, phaseId, services = {}) {
  return store.createKnowledgeEdge({
    fromNodeId: decisionId,
    toNodeId: phaseId,
    relation: 'documented_in',
    source: 'decision_memory',
    evidence: 'decision documented in phase'
  }, services);
}

function summarizeDecisionHistory(filters = {}, services = {}) {
  const decisions = store.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 500 }, services);
  const bySource = decisions.reduce((acc, d) => {
    const s = d.source || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return {
    total: decisions.length,
    core: decisions.filter(d => (d.tags || []).includes('core')).length,
    custom: decisions.filter(d => !(d.tags || []).includes('core')).length,
    bySource,
    protected: decisions.filter(d => utils.isProtectedDecisionTitle(d.title)).length
  };
}

function seedCoreDecisions(services = {}) {
  const seeded = [];
  for (const core of CORE_DECISIONS) {
    const res = recordDecisionMemory({
      ...core,
      source: 'core_decisions',
      sourceId: `core-${core.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
      tags: ['decision', 'core']
    }, services);
    if (res.ok) seeded.push(res.decision.id);
  }
  return { ok: true, seeded: seeded.length, ids: seeded };
}

module.exports = {
  recordDecisionMemory,
  searchDecisionMemory,
  linkDecisionToProject,
  linkDecisionToPhase,
  summarizeDecisionHistory,
  seedCoreDecisions,
  CORE_DECISIONS
};
