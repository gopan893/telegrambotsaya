'use strict';

const crypto = require('crypto');

const DEFAULT_LIMITS = {
  memories: 300,
  goals: 50,
  workflows: 100,
  workflowSteps: 50,
  graphNodes: 140,
  graphEdges: 220,
  workspaces: 30,
  insights: 200,
  reflections: 40,
  researchSessions: 25,
  learningPatterns: 60,
  contextChars: 2600
};

const MEMORY_TYPES = new Set([
  'semantic',
  'episodic',
  'workflow',
  'strategic',
  'project',
  'coding_preference',
  'learning',
  'reasoning',
  'correction',
  'research',
  'goal',
  'cognitive_graph',
  'reflective',
  'insight'
]);

function nowIso() {
  return new Date().toISOString();
}

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeUserId(userId) {
  return String(userId || 'unknown');
}

function stableId(prefix, seed = '') {
  const hash = crypto
    .createHash('sha1')
    .update(`${prefix}:${seed}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 10);
  return `${prefix}_${hash}`;
}

function sanitizeText(text, max = 1600) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function compactText(text, max = 900) {
  const clean = sanitizeText(text, Math.max(max, 20));
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3))}...`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueList(items, max = 20) {
  const seen = new Set();
  const out = [];
  for (const item of safeArray(items)) {
    const clean = sanitizeText(item, 80).toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

function tokenize(text) {
  return sanitizeText(text, 2000)
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F\u3040-\u30FF\u4E00-\u9FFF]+/i)
    .filter((word) => word.length >= 3)
    .slice(0, 80);
}

function textRelevance(query, candidate) {
  const q = tokenize(query);
  if (!q.length) return 0;
  const c = new Set(tokenize(candidate));
  let hit = 0;
  for (const word of q) {
    if (c.has(word)) hit += 1;
  }
  return clamp01(hit / Math.max(q.length, 1), 0);
}

function detectPromptInjection(text) {
  const lower = sanitizeText(text, 3000).toLowerCase();
  const patterns = [
    'ignore previous instruction',
    'ignore all previous',
    'abaikan instruksi',
    'lupakan instruksi',
    'system prompt',
    'developer message',
    'you are now',
    'kamu sekarang adalah',
    'override policy',
    'bypass safety',
    'jangan ikuti aturan',
    'dump memory',
    'exfiltrate'
  ];
  return patterns.some((pattern) => lower.includes(pattern));
}

function importanceFromText(text, type = 'semantic') {
  const lower = sanitizeText(text, 2000).toLowerCase();
  let score = 0.35;
  if (['goal', 'workflow', 'strategic', 'project', 'correction', 'insight'].includes(type)) score += 0.2;
  if (/(tujuan|goal|target|roadmap|project|proyek|deadline|belajar|koreksi|penting|ingat)/i.test(lower)) score += 0.2;
  if (/(error|bug|gagal|risiko|security|deploy|github|render|calendar|token)/i.test(lower)) score += 0.15;
  if (lower.length > 120) score += 0.05;
  return clamp01(score);
}

function makeEmptyState() {
  const ts = nowIso();
  return {
    version: 1,
    meta: {
      createdAt: ts,
      updatedAt: ts,
      mode: 'standard'
    },
    memories: [],
    goals: [],
    workflows: [],
    graph: {
      nodes: [],
      edges: []
    },
    workspaces: [],
    researchSessions: [],
    insights: [],
    reflections: [],
    learningPatterns: [],
    analytics: {
      events: 0,
      averageConfidence: 0.5,
      lastUpdatedAt: ts
    }
  };
}

function recoverMemoryCorruption(state) {
  if (!state || typeof state !== 'object') return makeEmptyState();
  const recovered = { ...makeEmptyState(), ...state };
  recovered.meta = { ...makeEmptyState().meta, ...(state.meta || {}) };
  recovered.memories = safeArray(state.memories);
  recovered.goals = safeArray(state.goals);
  recovered.workflows = safeArray(state.workflows);
  recovered.graph = {
    nodes: safeArray(state.graph?.nodes),
    edges: safeArray(state.graph?.edges)
  };
  recovered.workspaces = safeArray(state.workspaces);
  recovered.researchSessions = safeArray(state.researchSessions);
  recovered.insights = safeArray(state.insights);
  recovered.reflections = safeArray(state.reflections);
  recovered.learningPatterns = safeArray(state.learningPatterns);
  recovered.analytics = {
    events: Number(state.analytics?.events || 0),
    averageConfidence: clamp01(state.analytics?.averageConfidence, 0.5),
    lastUpdatedAt: state.analytics?.lastUpdatedAt || nowIso()
  };
  return recovered;
}

function ensureAIOSState(userId, botServices) {
  const { ensureUser } = botServices || {};
  if (typeof ensureUser !== 'function') {
    throw new Error('AI_OS_REQUIRE_ENSURE_USER');
  }
  const u = ensureUser(userId);
  u.aios = recoverMemoryCorruption(u.aios);
  u.aios.meta.updatedAt = nowIso();
  return u.aios;
}

function touchState(state) {
  if (state?.meta) state.meta.updatedAt = nowIso();
}

function pruneListByScore(items, limit, scorer) {
  const list = safeArray(items);
  if (list.length <= limit) return list;
  return list
    .map((item) => ({ item, score: scorer(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function cleanupStaleMemory(state, maxAgeDays = 120) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const before = state.memories.length;
  state.memories = state.memories.filter((memory) => {
    const ts = Date.parse(memory.updatedAt || memory.createdAt || 0);
    return memory.importance >= 0.72 || !ts || ts >= cutoff;
  });
  return before - state.memories.length;
}

function preventCognitiveOverload(input = {}) {
  const query = sanitizeText(input.query || input.userMessage || '', 4000);
  const complexSignals = [
    'strategi',
    'roadmap',
    'analisis',
    'rencana',
    'workflow',
    'research',
    'riset',
    'arsitektur',
    'keputusan',
    'trade-off',
    'risiko'
  ];
  const isSimple = query.length < 140 && !complexSignals.some((word) => query.toLowerCase().includes(word));
  return {
    allowDeepPipeline: !isSimple,
    reason: isSimple ? 'Pertanyaan pendek, gunakan jawaban langsung.' : 'Input membutuhkan konteks/strategi lebih panjang.',
    maxContextChars: isSimple ? 900 : DEFAULT_LIMITS.contextChars
  };
}

function preventRunawayWorkflow(workflow) {
  const steps = safeArray(workflow?.steps);
  if (steps.length <= DEFAULT_LIMITS.workflowSteps) return { ok: true };
  workflow.steps = steps.slice(0, DEFAULT_LIMITS.workflowSteps);
  return { ok: false, reason: 'WORKFLOW_STEP_LIMIT_APPLIED' };
}

function preventContextFragmentation(context = {}) {
  const fragments = safeArray(context.fragments);
  if (fragments.length <= 12) return { ok: true, fragments };
  return { ok: false, fragments: fragments.slice(-12), reason: 'CONTEXT_FRAGMENT_LIMIT_APPLIED' };
}

function containHallucination(answer, evidence = '') {
  const clean = sanitizeText(answer, 4000);
  if (!clean) return { ok: false, answer: 'Saya belum punya cukup informasi untuk menjawab dengan aman.' };
  const asksEvidence = /(berdasarkan file|menurut dokumen|sumber|evidence|bukti)/i.test(clean);
  if (asksEvidence && !sanitizeText(evidence, 600)) {
    return {
      ok: false,
      answer: `${clean}\n\nCatatan: bagian berbasis bukti perlu diverifikasi karena evidence yang tersedia terbatas.`
    };
  }
  return { ok: true, answer: clean };
}

function recursiveReasoningGuard(traceState = {}) {
  const depth = Number(traceState.depth || 0);
  if (depth > 2) {
    return { ok: false, reason: 'RECURSIVE_REASONING_LIMIT' };
  }
  return { ok: true, depth: depth + 1 };
}

function detectKnowledgeInconsistency(state, newText) {
  const lower = sanitizeText(newText, 1200).toLowerCase();
  if (!lower) return [];
  const signals = ['bukan', 'tidak lagi', 'koreksi', 'sebenarnya', 'salah'];
  if (!signals.some((signal) => lower.includes(signal))) return [];
  return state.memories
    .filter((memory) => textRelevance(lower, memory.content) > 0.35)
    .slice(0, 5)
    .map((memory) => memory.id);
}

function resolveWorkflowConflict(workflows = []) {
  const active = safeArray(workflows).filter((workflow) => workflow.status === 'active');
  const byTitle = new Map();
  const conflicts = [];
  for (const workflow of active) {
    const key = sanitizeText(workflow.title, 120).toLowerCase();
    if (!key) continue;
    if (byTitle.has(key)) conflicts.push([byTitle.get(key).id, workflow.id]);
    else byTitle.set(key, workflow);
  }
  return conflicts;
}

function blockUnsafeAutonomy(action = {}) {
  const text = sanitizeText(`${action.intent || ''} ${action.description || ''}`, 1200).toLowerCase();
  const risky = [
    'delete all',
    'hapus semua',
    'reset total',
    'force push',
    'transfer uang',
    'bayar',
    'kirim password',
    'token rahasia'
  ];
  if (detectPromptInjection(text) || risky.some((item) => text.includes(item))) {
    return { blocked: true, reason: 'UNSAFE_AUTONOMOUS_ACTION' };
  }
  return { blocked: false };
}

function blockLowConfidenceStrategicAction(confidence, action = {}) {
  const c = clamp01(confidence, 0.5);
  const mutates = !!action.mutatesState || /(buat|ubah|hapus|jadwalkan|kirim|deploy|push)/i.test(action.intent || action.description || '');
  if (mutates && c < 0.72) return { blocked: true, reason: 'LOW_CONFIDENCE_STRATEGIC_ACTION' };
  return { blocked: false };
}

function persistAsync(botServices) {
  if (!botServices || typeof botServices.persist !== 'function') return;
  const maybe = botServices.persist();
  if (maybe && typeof maybe.catch === 'function') {
    maybe.catch(() => {});
  }
}

module.exports = {
  DEFAULT_LIMITS,
  MEMORY_TYPES,
  nowIso,
  clamp01,
  normalizeUserId,
  stableId,
  sanitizeText,
  compactText,
  safeArray,
  uniqueList,
  tokenize,
  textRelevance,
  detectPromptInjection,
  importanceFromText,
  makeEmptyState,
  recoverMemoryCorruption,
  ensureAIOSState,
  touchState,
  pruneListByScore,
  cleanupStaleMemory,
  preventCognitiveOverload,
  preventRunawayWorkflow,
  preventContextFragmentation,
  containHallucination,
  recursiveReasoningGuard,
  detectKnowledgeInconsistency,
  resolveWorkflowConflict,
  blockUnsafeAutonomy,
  blockLowConfidenceStrategicAction,
  persistAsync
};
