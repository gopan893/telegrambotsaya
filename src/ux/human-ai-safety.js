'use strict';

const HIGH_STAKES_RE = /(medis|dokter|diagnosis|obat|kesehatan|hukum|legal|pengacara|kontrak|pajak|investasi|saham|crypto|utang|pinjaman|keuangan|asuransi|keselamatan|darurat|bunuh diri|self harm|kekerasan)/i;
const FOOTER = 'Catatan: gunakan ini sebagai kerangka berpikir, bukan keputusan final. Untuk topik penting, verifikasi dengan sumber tepercaya atau profesional.';

function isHighStakes(text = '') {
  return HIGH_STAKES_RE.test(String(text || ''));
}

function getPromptRules() {
  return [
    'Prinsip Human-AI Collaboration:',
    '- AI membantu memperjelas cara berpikir, bukan menggantikan keputusan manusia.',
    '- Untuk kesehatan, hukum, keuangan, keselamatan, atau keputusan besar: nyatakan batasan, hindari kepastian palsu, dan dorong verifikasi.',
    '- Bedakan fakta, inferensi, asumsi, risiko, dan opini saat user meminta analisis.',
    '- Jika evidence kurang atau confidence rendah, katakan dengan jelas.',
    '- Jangan menyimpan atau meminta data sensitif jika tidak perlu.'
  ].join('\n');
}

function buildContextNote(userText = '') {
  if (!isHighStakes(userText)) return '';
  return [
    '[HIGH-STAKES SAFETY NOTE]',
    '- Topik ini mungkin berdampak pada kesehatan, hukum, keuangan, keselamatan, atau keputusan besar.',
    '- Jawab sebagai framing dan pertanyaan kritis, bukan keputusan final.',
    '- Sertakan batasan dan anjuran verifikasi.'
  ].join('\n');
}

function hasHumanJudgmentFooter(answer = '') {
  const lower = String(answer || '').toLowerCase();
  return lower.includes('bukan keputusan final') || lower.includes('verifikasi dengan') || lower.includes('profesional');
}

function applyHumanJudgmentFooter(answer = '', userText = '') {
  const clean = String(answer || '').trim();
  if (!clean || !isHighStakes(userText) || hasHumanJudgmentFooter(clean)) return clean;
  return `${clean}\n\n${FOOTER}`;
}

module.exports = {
  applyHumanJudgmentFooter,
  buildContextNote,
  getPromptRules,
  isHighStakes
};
