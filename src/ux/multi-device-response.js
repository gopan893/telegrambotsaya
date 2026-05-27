'use strict';

const MAX_BLANK_LINES = 2;

const SYSTEM_RULES = [
  'Prioritaskan output yang nyaman dibaca di HP, tablet, laptop, desktop, Telegram mobile, Telegram desktop, dan web client.',
  'Gunakan paragraf pendek, section singkat, bullet sederhana, dan spacing rapi.',
  'Tampilkan inti jawaban lebih dulu; detail menyusul hanya jika memang membantu.',
  'Untuk jawaban panjang, pecah menjadi blok kecil seperti Ringkasan, Poin penting, Langkah berikutnya, Risiko, atau Rekomendasi jika relevan.',
  'Hindari dinding teks panjang, nested bullet dalam, tabel markdown besar, dan formatting yang terlalu ramai.',
  'Untuk kode, gunakan code block bersih, indentation rapi, dan sebutkan file/path dengan jelas jika relevan.',
  'Sesuaikan kepadatan: pertanyaan sederhana dijawab compact; masalah kompleks dijawab bertahap.',
  'Jangan menjelaskan aturan formatting ini kecuali pengguna memintanya.'
];

function getPromptRules() {
  return [
    'Aturan UX multi-device:',
    ...SYSTEM_RULES.map(rule => `- ${rule}`)
  ].join('\n');
}

function getCompactPromptHint() {
  return [
    'Format UX:',
    '- Mobile-friendly dan scan-friendly.',
    '- Paragraf pendek, bullet sederhana, section jelas.',
    '- Inti dulu, detail setelahnya.',
    '- Hindari tabel besar, nested bullet dalam, dan dinding teks.'
  ].join('\n');
}

function removeMarkdownEmphasis(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/g, '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[\s([{'"])\*([^*\n]+)\*(?=$|[\s.,!?;:)\]}'"])/g, '$1$2')
    .replace(/(^|[\s([{'"])_([^_\n]+)_(?=$|[\s.,!?;:)\]}'"])/g, '$1$2');
}

function normalizeBullet(line) {
  const trimmed = String(line || '').trimStart();
  if (/^[-*+]\s+/.test(trimmed)) {
    return `• ${trimmed.replace(/^[-*+]\s+/, '')}`;
  }
  return trimmed;
}

function normalizeLine(line, inCodeFence) {
  if (inCodeFence) {
    return String(line || '').replace(/[ \t]+$/g, '');
  }

  return removeMarkdownEmphasis(normalizeBullet(line))
    .replace(/[ \t]+$/g, '')
    .replace(/[ \t]{3,}/g, '  ');
}

function normalizeForTelegram(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');
  const output = [];
  let inCodeFence = false;
  let blankCount = 0;

  for (const line of lines) {
    const fenceLine = line.trim().startsWith('```');
    const normalized = normalizeLine(line, inCodeFence);
    const isBlank = normalized.trim() === '';

    if (fenceLine) {
      inCodeFence = !inCodeFence;
      blankCount = 0;
      output.push(normalized.trimEnd());
      continue;
    }

    if (!inCodeFence && isBlank) {
      blankCount += 1;
      if (blankCount <= MAX_BLANK_LINES) {
        output.push('');
      }
      continue;
    }

    blankCount = 0;
    output.push(normalized);
  }

  return output.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

module.exports = {
  getPromptRules,
  getCompactPromptHint,
  normalizeForTelegram
};
