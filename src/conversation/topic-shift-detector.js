'use strict';

const guards = require('./conversation-guards');
const followupDetector = require('./followup-detector');

function detectTopicShift(input = {}) {
  const text = guards.safeText(input.text);
  const pending = input.pending;
  const context = input.context || {};
  const followup = input.followup || followupDetector.detect(text);

  if (!pending) {
    return { shifted: false, confidence: 0, reason: 'no_pending_action' };
  }

  if (['affirm', 'deny', 'cancel', 'continue'].includes(followup.kind)) {
    return { shifted: false, confidence: 0.9, reason: 'explicit_pending_reply' };
  }

  const pendingText = [
    pending.topic,
    pending.query,
    pending.payload?.sourceUserText,
    pending.payload?.sourceBotAnswer,
    context.activeTopic
  ].filter(Boolean).join(' ');

  const overlap = guards.tokenOverlap(text, pendingText);
  const freshTopic = guards.isFreshTopicCandidate(text);
  const codeSignal = guards.hasCodeSignal(text);

  if ((freshTopic || codeSignal) && overlap < 0.12) {
    return {
      shifted: true,
      confidence: codeSignal ? 0.92 : 0.84,
      reason: codeSignal ? 'new_coding_or_technical_topic' : 'new_question_or_task_low_overlap',
      overlap
    };
  }

  if (text.length > 50 && overlap < 0.08) {
    return {
      shifted: true,
      confidence: 0.72,
      reason: 'long_message_low_topic_overlap',
      overlap
    };
  }

  return {
    shifted: false,
    confidence: 0.65,
    reason: overlap > 0 ? 'topic_overlap_detected' : 'no_strong_shift_signal',
    overlap
  };
}

module.exports = {
  detectTopicShift
};
