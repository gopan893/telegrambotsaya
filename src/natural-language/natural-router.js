'use strict';

const HEALTH_WORDS = [
  'pusing',
  'sakit kepala',
  'mual',
  'demam',
  'batuk',
  'flu',
  'lemas',
  'capek',
  'sakit perut',
  'tidak enak badan'
];

const TIME_UNITS = ['jam', 'hari', 'menit', 'minggu', 'bulan', 'tahun', 'detik'];
const FOLLOW_UP_PATTERNS = [
  /^kenapa\??$/i,
  /^mengapa\??$/i,
  /^maksudnya\??$/i,
  /^kok bisa\??$/i,
  /^jelaskan\.?$/i,
  /^jelaskan lagi\.?$/i
];

function safeText(text) {
  return String(text || '').trim();
}

function safeLower(text) {
  return safeText(text).toLowerCase();
}

function normalizeInputForRouting(text) {
  return safeText(text)
    .replace(/(\d+(?:[.,]\d+)?)(jam|hari|menit|minggu|bulan|tahun|detik)\b/gi, '$1 $2')
    .replace(/\b(jam|hari|menit|minggu|bulan|tahun|detik)(\d+(?:[.,]\d+)?)\b/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsTimeUnit(text) {
  const lower = safeLower(normalizeInputForRouting(text));
  return TIME_UNITS.some(unit => new RegExp(`\\b${unit}\\b`, 'i').test(lower));
}

function isPureMathExpression(text) {
  const normalized = normalizeInputForRouting(text).toLowerCase();
  if (containsTimeUnit(normalized)) return false;
  const expr = normalized.replace(/^hitung\s+/i, '').trim();
  if (!expr) return false;
  if (!/^[0-9\s()+\-*/%.]+$/.test(expr)) return false;
  return /[+\-*/%]/.test(expr);
}

function extractPureMathExpression(text) {
  if (!isPureMathExpression(text)) return '';
  return normalizeInputForRouting(text)
    .replace(/^hitung\s+/i, '')
    .replace(/[^0-9+\-*/().%]/g, '')
    .trim();
}

function detectHealthAdvice(text) {
  const lower = safeLower(normalizeInputForRouting(text));
  return HEALTH_WORDS.some(word => lower.includes(word));
}

function detectFollowUp(text) {
  const clean = safeText(text).replace(/\s+/g, ' ').trim();
  return FOLLOW_UP_PATTERNS.some(pattern => pattern.test(clean));
}

function parseNumber(text) {
  return Number(String(text || '').replace(',', '.'));
}

function formatNumber(value, maxFractionDigits = 2) {
  const rounded = Number(value.toFixed(maxFractionDigits));
  return String(rounded).replace('.', ',');
}

function splitWholeRemainder(total, unitSize) {
  const whole = Math.floor(total / unitSize);
  const remainder = total - (whole * unitSize);
  return { whole, remainder };
}

function formatUnitValue(value, unit) {
  const clean = Number.isInteger(value) ? String(value) : formatNumber(value);
  return `${clean} ${unit}`;
}

function buildConversionResult(value, sourceUnit, targetUnit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  if (sourceUnit === 'jam' && targetUnit === 'hari') {
    const { whole, remainder } = splitWholeRemainder(n, 24);
    const detail = remainder ? `${whole} hari ${formatNumber(remainder, 4)} jam` : `${whole} hari`;
    return `${formatUnitValue(n, 'jam')} = ${detail}. Karena ${formatNumber(n)} ÷ 24 = ${formatNumber(n / 24)} hari.`;
  }

  if (sourceUnit === 'hari' && targetUnit === 'jam') {
    return `${formatUnitValue(n, 'hari')} = ${formatNumber(n * 24)} jam. Karena ${formatNumber(n)} × 24 = ${formatNumber(n * 24)} jam.`;
  }

  if (sourceUnit === 'menit' && targetUnit === 'jam') {
    const { whole, remainder } = splitWholeRemainder(n, 60);
    const detail = remainder ? `${whole} jam ${formatNumber(remainder, 4)} menit` : `${whole} jam`;
    return `${formatUnitValue(n, 'menit')} = ${detail}. Karena ${formatNumber(n)} ÷ 60 = ${formatNumber(n / 60)} jam.`;
  }

  if (sourceUnit === 'jam' && targetUnit === 'menit') {
    return `${formatUnitValue(n, 'jam')} = ${formatNumber(n * 60)} menit. Karena ${formatNumber(n)} × 60 = ${formatNumber(n * 60)} menit.`;
  }

  if (sourceUnit === 'minggu' && targetUnit === 'hari') {
    return `${formatUnitValue(n, 'minggu')} = ${formatNumber(n * 7)} hari. Karena ${formatNumber(n)} × 7 = ${formatNumber(n * 7)} hari.`;
  }

  if (sourceUnit === 'hari' && targetUnit === 'minggu') {
    const { whole, remainder } = splitWholeRemainder(n, 7);
    const detail = remainder ? `${whole} minggu ${formatNumber(remainder, 4)} hari` : `${whole} minggu`;
    return `${formatUnitValue(n, 'hari')} = ${detail}. Karena ${formatNumber(n)} ÷ 7 = ${formatNumber(n / 7)} minggu.`;
  }

  return null;
}

function detectUnitConversion(text) {
  const normalized = normalizeInputForRouting(text).toLowerCase();
  if (!containsTimeUnit(normalized)) return null;
  if (!/\b(berapa|konversi|ubah|jadi|ke|dalam)\b/i.test(normalized)) return null;

  const source = normalized.match(/(\d+(?:[.,]\d+)?)\s+(jam|hari|menit|minggu)\b/i);
  if (!source) return null;

  const target = normalized.match(/\bberapa\s+(jam|hari|menit|minggu)\b/i)
    || normalized.match(/\b(?:ke|jadi|dalam)\s+(jam|hari|menit|minggu)\b/i);

  if (!target) return null;

  const value = parseNumber(source[1]);
  const sourceUnit = source[2].toLowerCase();
  const targetUnit = target[1].toLowerCase();
  if (sourceUnit === targetUnit) return null;

  const answer = buildConversionResult(value, sourceUnit, targetUnit);
  if (!answer) return null;

  return {
    value,
    sourceUnit,
    targetUnit,
    answer
  };
}

function buildHealthAdvice(text) {
  const lower = safeLower(text);
  const symptom = HEALTH_WORDS.find(word => lower.includes(word)) || 'keluhan itu';
  return [
    `Aku ikut prihatin kamu merasa ${symptom}.`,
    '',
    'Aku bukan dokter, jadi aku tidak bisa memberi diagnosis pasti. Tapi untuk keluhan ringan, kamu bisa coba:',
    '• minum air putih cukup;',
    '• istirahat di tempat yang tenang;',
    '• makan ringan kalau belum makan;',
    '• kurangi layar/cahaya terang sementara;',
    '• pantau apakah gejalanya membaik.',
    '',
    'Segera cari bantuan medis jika gejalanya berat, muncul mendadak, disertai sesak, nyeri dada, leher kaku, muntah terus, pingsan, kelemahan satu sisi tubuh, demam tinggi, atau tidak membaik.'
  ].join('\n');
}

function detectNaturalIntent(text, options = {}) {
  const normalizedText = normalizeInputForRouting(text);
  const lower = safeLower(normalizedText);
  const conversion = detectUnitConversion(normalizedText);

  if (conversion) {
    return {
      intent: 'UNIT_CONVERSION',
      confidence: 0.98,
      normalizedText,
      conversion
    };
  }

  if (isPureMathExpression(normalizedText)) {
    return {
      intent: 'MATH_CALCULATION',
      confidence: 0.96,
      normalizedText,
      expression: extractPureMathExpression(normalizedText)
    };
  }

  if (detectHealthAdvice(normalizedText)) {
    return {
      intent: 'HEALTH_ADVICE',
      confidence: 0.86,
      normalizedText
    };
  }

  if (detectFollowUp(normalizedText)) {
    return {
      intent: lower.includes('jelaskan') ? 'EXPLANATION_REQUEST' : 'FOLLOW_UP',
      confidence: 0.82,
      normalizedText,
      needsContext: true
    };
  }

  if (/\b(sedih|cemas|takut|stres|stress|bingung|capek mental|overthinking)\b/i.test(lower)) {
    return { intent: 'EMOTIONAL_SUPPORT', confidence: 0.72, normalizedText };
  }

  if (/\b(belajar|ajarkan|latihan|roadmap|materi|mentor)\b/i.test(lower)) {
    return { intent: 'LEARNING_HELP', confidence: 0.74, normalizedText };
  }

  if (/\b(pilih|lebih baik|keputusan|opsi|bandingkan|rekomendasi)\b/i.test(lower)) {
    return { intent: 'DECISION_SUPPORT', confidence: 0.74, normalizedText };
  }

  return {
    intent: 'GENERAL_CHAT',
    confidence: options.conversationState?.action === 'continue' ? 0.76 : 0.62,
    normalizedText
  };
}

function shouldBypassMathTool(text) {
  return containsTimeUnit(text);
}

module.exports = {
  buildHealthAdvice,
  containsTimeUnit,
  detectFollowUp,
  detectHealthAdvice,
  detectNaturalIntent,
  detectUnitConversion,
  extractPureMathExpression,
  isPureMathExpression,
  normalizeInputForRouting,
  shouldBypassMathTool
};
