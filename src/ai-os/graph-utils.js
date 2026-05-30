'use strict';

const crypto = require('crypto');

const DEFAULT_GRAPH_LIMITS = {
  maxNodesPerUser: 500,
  maxEdgesPerUser: 1200,
  maxAliasesPerNode: 20,
  topK: 8,
  edgeTopK: 12,
  summaryChars: 2000
};

function nowIso() {
  return new Date().toISOString();
}

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function compactText(text = '', max = 240) {
  const clean = String(text || '')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function normalizeUserId(userId) {
  return String(userId || 'unknown');
}

function normalizeConcept(label = '') {
  const clean = compactText(label, 120)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s*[:;,.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const canonical = {
    postgres: 'PostgreSQL',
    postgresql: 'PostgreSQL',
    redis: 'Redis',
    nodejs: 'Node.js',
    'node.js': 'Node.js',
    express: 'Express',
    telegram: 'Telegram',
    render: 'Render',
    github: 'GitHub',
    docker: 'Docker',
    nextjs: 'Next.js',
    'next.js': 'Next.js',
    react: 'React',
    tailwind: 'Tailwind',
    prisma: 'Prisma',
    supabase: 'Supabase',
    neon: 'Neon',
    groq: 'Groq',
    mistral: 'Mistral',
    tavily: 'Tavily',
    cloudflare: 'Cloudflare',
    termux: 'Termux',
    'ai os': 'AI OS'
  };

  const key = clean.toLowerCase();
  return canonical[key] || clean;
}

function normalizeKey(label = '') {
  return normalizeConcept(label).toLowerCase();
}

function stableHash(seed = '', length = 12) {
  return crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, length);
}

function makeNodeId(userId, label) {
  return `node_${stableHash(`${normalizeUserId(userId)}:${normalizeKey(label)}`)}`;
}

function makeEdgeId(userId, fromId, toId, relationship) {
  return `edge_${stableHash(`${normalizeUserId(userId)}:${fromId}:${toId}:${relationship}`)}`;
}

function tokenize(text = '') {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F\u3040-\u30FF\u4E00-\u9FFF.+#-]+/i)
    .filter(word => word.length >= 2)
    .slice(0, 120);
}

function textScore(query = '', candidate = '') {
  const q = tokenize(query);
  if (!q.length) return 0;
  const c = new Set(tokenize(candidate));
  let hits = 0;
  for (const token of q) {
    if (c.has(token)) hits += 1;
  }
  return clamp01(hits / q.length, 0);
}

function uniqueStrings(items = [], max = 20) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const clean = normalizeConcept(item);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

function mergeUnique(a = [], b = [], max = 20) {
  return uniqueStrings([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])], max);
}

function countBy(items = [], selector) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const key = typeof selector === 'function' ? selector(item) : item?.[selector];
    const clean = key || 'unknown';
    acc[clean] = (acc[clean] || 0) + 1;
    return acc;
  }, {});
}

function recencyScore(iso, halfLifeDays = 60) {
  const time = Date.parse(iso || '');
  if (!time) return 0.2;
  const ageDays = Math.max(0, (Date.now() - time) / (24 * 60 * 60 * 1000));
  return clamp01(1 / (1 + ageDays / Math.max(1, halfLifeDays)), 0.2);
}

function nodeSearchText(node = {}) {
  return [
    node.label,
    node.type,
    node.summary,
    ...(Array.isArray(node.aliases) ? node.aliases : []),
    ...(Array.isArray(node.tags) ? node.tags : [])
  ].filter(Boolean).join(' ');
}

function edgeSearchText(edge = {}, labelById = new Map()) {
  return [
    labelById.get(edge.from) || labelById.get(edge.fromNodeId) || edge.from || edge.fromNodeId,
    edge.relationship,
    labelById.get(edge.to) || labelById.get(edge.toNodeId) || edge.to || edge.toNodeId,
    edge.evidence,
    edge.source
  ].filter(Boolean).join(' ');
}

function scoreNode(node = {}, query = '') {
  const relevance = textScore(query, nodeSearchText(node));
  const importance = clamp01(node.importance, 0.5);
  const confidence = clamp01(node.confidence, 0.5);
  const occurrence = Math.min(1, Number(node.occurrenceCount || node.seenCount || 1) / 8);
  const recency = recencyScore(node.lastSeenAt || node.updatedAt || node.createdAt);
  return Number((relevance * 0.45 + importance * 0.22 + confidence * 0.13 + occurrence * 0.1 + recency * 0.1).toFixed(4));
}

function scoreEdge(edge = {}, query = '', labelById = new Map()) {
  const relevance = textScore(query, edgeSearchText(edge, labelById));
  const weight = clamp01(edge.weight, 0.5);
  const confidence = clamp01(edge.confidence, 0.5);
  const occurrence = Math.min(1, Number(edge.occurrenceCount || 1) / 8);
  const recency = recencyScore(edge.updatedAt || edge.createdAt);
  return Number((relevance * 0.4 + weight * 0.22 + confidence * 0.18 + occurrence * 0.1 + recency * 0.1).toFixed(4));
}

function limitArray(items = [], limit = DEFAULT_GRAPH_LIMITS.topK) {
  const n = Math.max(0, Math.min(Number(limit) || DEFAULT_GRAPH_LIMITS.topK, 100));
  return (Array.isArray(items) ? items : []).slice(0, n);
}

function labelForNodeId(nodes = [], id) {
  const node = (Array.isArray(nodes) ? nodes : []).find(item => item.id === id);
  return node?.label || id;
}

module.exports = {
  DEFAULT_GRAPH_LIMITS,
  clamp01,
  compactText,
  countBy,
  edgeSearchText,
  labelForNodeId,
  limitArray,
  makeEdgeId,
  makeNodeId,
  mergeUnique,
  nodeSearchText,
  normalizeConcept,
  normalizeKey,
  normalizeUserId,
  nowIso,
  recencyScore,
  scoreEdge,
  scoreNode,
  stableHash,
  textScore,
  tokenize,
  uniqueStrings
};
