'use strict';

const guards = require('./guards');
const memoryBus = require('./memory-bus');

function createResearchSession(userId, topic, botServices, options = {}) {
  const state = guards.ensureAIOSState(userId, botServices);
  const cleanTopic = guards.sanitizeText(topic, 220);
  if (!cleanTopic) return { ok: false, reason: 'TOPIC_REQUIRED' };
  const ts = guards.nowIso();
  const session = {
    id: options.id || guards.stableId('research', `${userId}:${cleanTopic}`),
    userId: guards.normalizeUserId(userId),
    topic: cleanTopic,
    status: 'active',
    evidence: [],
    sourceSummary: '',
    confidence: 0.5,
    openQuestions: [],
    createdAt: ts,
    updatedAt: ts
  };
  state.researchSessions.push(session);
  state.researchSessions = guards.pruneListByScore(state.researchSessions, guards.DEFAULT_LIMITS.researchSessions, scoreSession);
  memoryBus.publish(userId, {
    type: 'research',
    content: `Research session: ${cleanTopic}`,
    tags: ['research'],
    source: 'research-intelligence',
    confidence: 0.72,
    importance: 0.7
  }, botServices);
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, session };
}

function addEvidence(userId, sessionId, evidence = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const session = state.researchSessions.find((item) => item.id === sessionId);
  if (!session) return { ok: false, reason: 'RESEARCH_SESSION_NOT_FOUND' };
  const entry = {
    id: guards.stableId('ev', `${sessionId}:${evidence.title || evidence.url || evidence.text}`),
    title: guards.sanitizeText(evidence.title || 'Evidence', 160),
    url: guards.sanitizeText(evidence.url || '', 300),
    text: guards.sanitizeText(evidence.text || evidence.summary || '', 1000),
    confidence: guards.clamp01(evidence.confidence, 0.6),
    source: guards.compactText(evidence.source || 'manual', 80),
    createdAt: guards.nowIso()
  };
  if (!entry.text && !entry.url) return { ok: false, reason: 'EVIDENCE_REQUIRED' };
  session.evidence.push(entry);
  session.evidence = session.evidence.slice(-20);
  session.confidence = confidenceAnalysis(session.evidence).confidence;
  session.sourceSummary = synthesizeEvidence(session.evidence).summary;
  session.updatedAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, session, evidence: entry };
}

function synthesizeEvidence(evidence = []) {
  const items = guards.safeArray(evidence);
  if (!items.length) return { summary: '-', strengths: [], gaps: ['Belum ada evidence tersimpan.'] };
  const strengths = items
    .filter((item) => item.confidence >= 0.65)
    .slice(-5)
    .map((item) => `${item.title}: ${guards.compactText(item.text || item.url, 160)}`);
  const gaps = [];
  if (items.length < 2) gaps.push('Butuh lebih dari satu evidence untuk cross-check.');
  if (!items.some((item) => item.url)) gaps.push('Belum ada URL/sumber eksternal yang bisa diaudit.');
  return {
    summary: strengths.join('\n') || '-',
    strengths,
    gaps
  };
}

function confidenceAnalysis(evidence = []) {
  const items = guards.safeArray(evidence);
  if (!items.length) return { confidence: 0.35, reason: 'Belum ada evidence.' };
  const avg = items.reduce((sum, item) => sum + guards.clamp01(item.confidence, 0.5), 0) / items.length;
  const diversity = new Set(items.map((item) => item.url || item.source || item.title)).size;
  const score = guards.clamp01(avg * 0.72 + Math.min(diversity, 4) * 0.07);
  return {
    confidence: Number(score.toFixed(3)),
    reason: diversity >= 2 ? 'Ada beberapa evidence untuk dibandingkan.' : 'Evidence masih terbatas.'
  };
}

function getActiveResearch(userId, botServices, limit = 5) {
  const state = guards.ensureAIOSState(userId, botServices);
  return state.researchSessions
    .filter((session) => session.status === 'active')
    .sort((a, b) => scoreSession(b) - scoreSession(a))
    .slice(0, limit);
}

function buildResearchContext(userId, query = '', botServices) {
  const sessions = getActiveResearch(userId, botServices, 5)
    .map((session) => ({
      session,
      score: guards.textRelevance(query, `${session.topic} ${session.sourceSummary}`) + scoreSession(session)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.session);

  if (!sessions.length) return '-';
  return sessions.map((session) => [
    `- ${session.topic} (confidence ${session.confidence.toFixed(2)})`,
    guards.compactText(session.sourceSummary || '-', 260)
  ].join('\n')).join('\n');
}

function scoreSession(session) {
  const active = session.status === 'active' ? 0.25 : 0;
  const evidence = Math.min(0.25, guards.safeArray(session.evidence).length * 0.05);
  const confidence = (session.confidence || 0.5) * 0.35;
  const updated = Date.parse(session.updatedAt || session.createdAt || 0);
  const recency = updated ? Math.max(0, 0.15 - ((Date.now() - updated) / (90 * 24 * 60 * 60 * 1000))) : 0.05;
  return active + evidence + confidence + recency;
}

function resetResearch(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.researchSessions = [];
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  createResearchSession,
  addEvidence,
  synthesizeEvidence,
  confidenceAnalysis,
  getActiveResearch,
  buildResearchContext,
  resetResearch
};
