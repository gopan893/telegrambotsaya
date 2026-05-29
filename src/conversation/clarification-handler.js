'use strict';

const guards = require('./conversation-guards');

function needsClarification(input = {}) {
  const followup = input.followup || {};
  const hasContext = Boolean(input.hasContext);
  const hasPending = Boolean(input.pending);

  if (hasPending) return false;
  if (!['affirm', 'continue', 'referential'].includes(followup.kind)) return false;
  return !hasContext;
}

function buildClarification(input = {}) {
  const text = guards.safeLower(input.text);

  if (text.includes('lanjut')) {
    return 'Maksud kamu lanjut bagian yang mana? Kirim topik atau pesan sebelumnya yang ingin dilanjutkan.';
  }

  if (text.includes('jelaskan') || text.includes('detail')) {
    return 'Bagian mana yang ingin kamu jelaskan lebih detail? Kirim topiknya agar aku tidak salah konteks.';
  }

  return 'Maksud kamu yang mana? Kirim sedikit konteks supaya aku bisa lanjut dengan tepat.';
}

function shouldAskClarification(text, state, detection = {}) {
  return needsClarification({
    text,
    followup: detection.kind ? detection : { kind: detection.type },
    hasContext: Boolean(state?.activeTopic || state?.lastBotResponseSummary),
    pending: null
  }) || Number(detection.confidence || 1) < 0.42;
}

function buildClarificationQuestion(text, state = {}) {
  if (state.activeTopic) {
    return `Maksud kamu ingin melanjutkan bagian "${state.activeTopic}", atau mau bahas topik baru?`;
  }
  return buildClarification({ text });
}

function buildLowContextResponse() {
  return 'Aku butuh sedikit konteks supaya tidak salah jawab. Maksud kamu ingin lanjut bagian yang mana?';
}

module.exports = {
  buildClarification,
  buildClarificationQuestion,
  buildLowContextResponse,
  needsClarification,
  shouldAskClarification
};
