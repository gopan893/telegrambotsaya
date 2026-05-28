'use strict';

const guards = require('./guards');
const memoryBus = require('./memory-bus');

function learnFromCorrection(userId, original, correction, botServices) {
  const lesson = buildLesson('correction', original, correction);
  return storeLearningInsight(userId, lesson, botServices, { tags: ['correction', 'learning'] });
}

function learnFromFeedback(userId, feedback, botServices) {
  const clean = guards.sanitizeText(feedback, 900);
  if (!clean) return { ok: false, reason: 'FEEDBACK_REQUIRED' };
  return storeLearningInsight(userId, `Feedback user: ${clean}`, botServices, { tags: ['feedback', 'learning'] });
}

function evolvePattern(userId, pattern, botServices, options = {}) {
  const state = guards.ensureAIOSState(userId, botServices);
  const clean = guards.sanitizeText(pattern, 700);
  if (!clean) return { ok: false, reason: 'PATTERN_REQUIRED' };
  const existing = state.learningPatterns.find((item) => guards.textRelevance(clean, item.pattern) > 0.8);
  if (existing) {
    existing.count += 1;
    existing.confidence = guards.clamp01((existing.confidence || 0.55) + 0.05);
    existing.updatedAt = guards.nowIso();
  } else {
    state.learningPatterns.push({
      id: guards.stableId('learn', clean),
      userId: guards.normalizeUserId(userId),
      pattern: clean,
      type: options.type || 'behavior',
      count: 1,
      confidence: guards.clamp01(options.confidence, 0.58),
      createdAt: guards.nowIso(),
      updatedAt: guards.nowIso()
    });
  }
  state.learningPatterns = guards.pruneListByScore(state.learningPatterns, guards.DEFAULT_LIMITS.learningPatterns, (item) => {
    return (item.count || 1) * 0.08 + (item.confidence || 0.5);
  });
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, pattern: existing || state.learningPatterns[state.learningPatterns.length - 1] };
}

function storeLearningInsight(userId, insight, botServices, options = {}) {
  const clean = guards.sanitizeText(insight, 900);
  if (!clean || guards.detectPromptInjection(clean)) return { ok: false, reason: 'LEARNING_REJECTED' };
  const memory = memoryBus.publish(userId, {
    type: options.type || 'insight',
    content: clean,
    tags: options.tags || ['learning'],
    source: 'learning-evolution',
    confidence: options.confidence ?? 0.72,
    importance: options.importance ?? guards.importanceFromText(clean, 'insight')
  }, botServices);
  memoryBus.publishInsight(userId, clean, botServices, {
    tags: options.tags || ['learning'],
    source: 'learning-evolution',
    confidence: options.confidence ?? 0.72,
    importance: options.importance ?? 0.72
  });
  evolvePattern(userId, clean, botServices, { type: options.patternType || 'learning', confidence: options.confidence || 0.65 });
  return memory;
}

function buildLesson(kind, original, correction) {
  const left = guards.compactText(original, 260);
  const right = guards.compactText(correction, 420);
  return `${kind}: sebelumnya "${left}", koreksi/pelajaran "${right}"`;
}

function getLearningSummary(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const patterns = [...state.learningPatterns]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 6);
  return patterns.map((item) => `- ${item.pattern} (x${item.count}, confidence ${(item.confidence || 0).toFixed(2)})`).join('\n') || '-';
}

function resetLearning(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.learningPatterns = [];
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  learnFromCorrection,
  learnFromFeedback,
  evolvePattern,
  storeLearningInsight,
  getLearningSummary,
  resetLearning
};
