'use strict';

const CURHAT_PATTERNS = [
  /\b(mau|ingin|pengen|butuh)\s+(curhat|cerita)\b/i,
  /\b(curhat|cerita)\s+(dong|dulu|sebentar|bentar)\b/i,
  /\bbutuh\s+teman\s+(cerita|ngobrol)\b/i,
  /\blagi\s+(sedih|down|capek|lelah|hancur|kosong|kesepian|overthinking)\b/i,
  /\b(capek|lelah)\s+banget\b/i,
  /\baku\s+(sedih|kesepian|overthinking|tertekan)\b/i
];

const CRISIS_PATTERNS = [
  /\b(bunuh\s+diri|mengakhiri\s+hidup|akhiri\s+hidup)\b/i,
  /\b(nyakitin|menyakiti)\s+diri\b/i,
  /\bself[-\s]?harm\b/i,
  /\b(mati\s+aja|tidak\s+mau\s+hidup|nggak\s+mau\s+hidup|ga\s+mau\s+hidup)\b/i
];

function detectCurhatIntent(text = '') {
  const value = String(text || '').trim();
  return CURHAT_PATTERNS.some((pattern) => pattern.test(value));
}

function detectCrisisSignal(text = '') {
  const value = String(text || '').trim();
  return CRISIS_PATTERNS.some((pattern) => pattern.test(value));
}

function buildCurhatInstruction(options = {}) {
  const crisis = Boolean(options.crisis);
  return [
    'User sedang ingin curhat. Respons sebagai pendengar suportif, hangat, dan tidak menghakimi.',
    'Validasi perasaan user dengan bahasa sederhana. Jangan meremehkan masalahnya.',
    'Beri arahan positif yang kecil dan realistis, bukan ceramah panjang.',
    'Ajak user cerita lebih lanjut dengan satu pertanyaan lembut.',
    'Jangan diagnosis medis/psikologis. Jangan mengklaim sebagai terapis atau dokter.',
    crisis ? 'Ada sinyal krisis. Utamakan keselamatan: sarankan user menghubungi orang tepercaya sekarang, jangan sendirian, dan hubungi layanan darurat lokal jika merasa bisa melukai diri.' : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  detectCrisisSignal,
  detectCurhatIntent,
  buildCurhatInstruction
};
