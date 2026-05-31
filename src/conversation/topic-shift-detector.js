'use strict';

const guards = require('./conversation-guards');
const followupDetector = require('./followup-detector');

const CODING_WORDS = ['kode', 'coding', 'debug', 'error', 'next.js', 'nextjs', 'react', 'node', 'express', 'prisma', 'login', 'auth', 'api'];
const LEARNING_WORDS = ['belajar', 'roadmap belajar', 'latihan', 'materi', 'dari nol', 'mentor'];
const DECISION_WORDS = ['pilih', 'bandingkan', 'vs', 'versus', 'lebih baik', 'trade-off', 'opsi', 'keputusan'];
const OPS_WORDS = ['render', 'deploy', 'webhook', 'latency', 'health', 'diagnostics', 'recovery', 'server', 'redis error', 'postgres'];
const WELLNESS_WORDS = ['tidur', 'pusing', 'sakit', 'mual', 'demam', 'lemas', 'capek', 'kesehatan', 'kebiasaan', 'stres', 'cemas'];

function hasAny(text, words) {
  return guards.includesAny(text, words);
}

function isCodingTopic(text) {
  return hasAny(text, CODING_WORDS) || /\bbuat(kan)?\s+(kode|fitur|login|api|script)\b/i.test(text);
}

function isLearningTopic(text) {
  return hasAny(text, LEARNING_WORDS);
}

function isDecisionTopic(text) {
  return hasAny(text, DECISION_WORDS);
}

function isOpsTopic(text) {
  return hasAny(text, OPS_WORDS);
}

function isWellnessTopic(text) {
  return hasAny(text, WELLNESS_WORDS);
}

function extractLikelyTopic(text) {
  if (isCodingTopic(text)) return `coding_${guards.extractTopic(text, 'coding')}`;
  if (isLearningTopic(text)) return `learning_${guards.extractTopic(text, 'learning')}`;
  if (isDecisionTopic(text)) return `decision_${guards.extractTopic(text, 'decision')}`;
  if (isOpsTopic(text)) return `ops_${guards.extractTopic(text, 'ops')}`;
  if (isWellnessTopic(text)) return `wellness_${guards.extractTopic(text, 'wellness')}`;
  return guards.extractTopic(text, 'topik baru');
}

function detectIntent(text) {
  if (isCodingTopic(text)) return 'coding';
  if (isLearningTopic(text)) return 'learning';
  if (isDecisionTopic(text)) return 'decision';
  if (isOpsTopic(text)) return 'ops';
  if (isWellnessTopic(text)) return 'wellness';
  if (guards.isQuestion(text)) return 'general_question';
  return 'general_chat';
}

function normalizeResult(result) {
  return {
    isTopicShift: Boolean(result.shifted),
    shifted: Boolean(result.shifted),
    newTopic: result.newTopic || '',
    newIntent: result.newIntent || '',
    confidence: Number(result.confidence || 0),
    reason: result.reason || '',
    overlap: result.overlap
  };
}

function detectTopicShift(input = {}) {
  const text = guards.safeText(input.text);
  const pending = input.pending || null;
  const context = input.context || {};
  const followup = input.followup || followupDetector.detect(text);
  const activeTopic = context.activeTopic || pending?.topic || '';
  const activeText = [
    pending?.topic,
    pending?.query,
    pending?.payload?.sourceUserText,
    pending?.payload?.sourceBotAnswer,
    activeTopic
  ].filter(Boolean).join(' ');

  if (!text) {
    return normalizeResult({ shifted: false, confidence: 0, reason: 'empty_message' });
  }

  if (['affirm', 'deny', 'cancel'].includes(followup.kind)) {
    return normalizeResult({ shifted: false, confidence: 0.9, reason: 'explicit_short_pending_reply' });
  }

  if (!activeText) {
    return normalizeResult({ shifted: false, confidence: 0, reason: 'no_active_context' });
  }

  if (['continue', 'referential'].includes(followup.kind)) {
    return normalizeResult({ shifted: false, confidence: 0.84, reason: 'followup_reference' });
  }

  const overlap = guards.tokenOverlap(text, activeText);
  const freshTopic = guards.isFreshTopicCandidate(text);
  const newIntent = detectIntent(text);
  const oldIntent = guards.safeLower(context.lastIntent || context.activeIntent || pending?.type || '');
  const strongNewDomain = ['coding', 'learning', 'ops', 'wellness'].includes(newIntent) &&
    !oldIntent.includes(newIntent) &&
    overlap < 0.18;

  if ((freshTopic || strongNewDomain) && overlap < 0.12) {
    return normalizeResult({
      shifted: true,
      confidence: strongNewDomain ? 0.92 : 0.78,
      reason: strongNewDomain ? 'new_domain_detected' : 'new_question_low_overlap',
      newTopic: extractLikelyTopic(text),
      newIntent,
      overlap
    });
  }

  if (text.length > 60 && overlap < 0.08) {
    return normalizeResult({
      shifted: true,
      confidence: 0.72,
      reason: 'long_message_low_topic_overlap',
      newTopic: extractLikelyTopic(text),
      newIntent,
      overlap
    });
  }

  return normalizeResult({
    shifted: false,
    confidence: overlap > 0 ? 0.68 : 0.45,
    reason: overlap > 0 ? 'topic_overlap_detected' : 'no_strong_shift_signal',
    newTopic: activeTopic,
    newIntent: oldIntent || newIntent,
    overlap
  });
}

module.exports = {
  detectTopicShift,
  extractLikelyTopic,
  isCodingTopic,
  isDecisionTopic,
  isLearningTopic,
  isOpsTopic,
  isWellnessTopic
};
