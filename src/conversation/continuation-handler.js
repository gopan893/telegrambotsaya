'use strict';

const guards = require('./conversation-guards');

function buildPendingInstruction(text, pending, followup) {
  const topic = pending?.topic || pending?.query || 'topik sebelumnya';
  const sourceBot = pending?.payload?.sourceBotAnswer || '';
  const kind = followup?.kind || 'continue';

  if (kind === 'affirm') {
    return [
      `User menjawab afirmatif untuk pending action "${pending.type}" tentang "${topic}".`,
      'Lanjutkan bantuan yang sebelumnya ditawarkan.',
      'Jangan mengulang tawaran lama; langsung berikan langkah atau jawaban berikutnya secara natural.',
      sourceBot ? `Tawaran bot sebelumnya: ${guards.compactText(sourceBot, 260)}` : ''
    ].filter(Boolean).join(' ');
  }

  return [
    `User meminta lanjutan terkait "${topic}".`,
    'Gunakan konteks percakapan sebelumnya hanya jika relevan.',
    'Jika ada beberapa kemungkinan lanjutan, pilih yang paling masuk akal atau minta klarifikasi singkat.'
  ].join(' ');
}

function buildContextInstruction(text, context, followup) {
  const topic = context?.activeTopic || 'topik sebelumnya';
  const kind = followup?.kind || 'continue';

  if (kind === 'referential') {
    return `User merujuk ke "${topic}". Jawab berdasarkan konteks terakhir jika cukup jelas; jika tidak, minta klarifikasi singkat.`;
  }

  return `User ingin melanjutkan pembahasan "${topic}". Jangan mengulang jawaban lama; lanjutkan dengan informasi baru yang relevan.`;
}

function buildContinuation(input = {}) {
  const text = guards.safeText(input.text);
  const pending = input.pending || null;
  const context = input.context || {};
  const followup = input.followup || {};
  const baseContext = input.promptContext || '';

  return {
    action: 'continue',
    originalText: text,
    promptContext: baseContext,
    instruction: pending
      ? buildPendingInstruction(text, pending, followup)
      : buildContextInstruction(text, context, followup),
    pending
  };
}

module.exports = {
  buildContinuation
};
