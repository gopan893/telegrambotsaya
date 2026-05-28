'use strict';

const guards = require('./conversation-guards');

function needsClarification(input = {}) {
  const followup = input.followup || {};
  const hasContext = Boolean(input.hasContext);
  const hasPending = Boolean(input.pending);

  if (hasPending) return false;
  if (!['continue', 'referential'].includes(followup.kind)) return false;
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

module.exports = {
  buildClarification,
  needsClarification
};
