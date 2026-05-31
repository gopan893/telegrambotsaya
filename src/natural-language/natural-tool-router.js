'use strict';

const naturalRouter = require('./natural-router');

const INTENTS = {
  WEATHER: 'WEATHER',
  WEB_SEARCH: 'WEB_SEARCH',
  TIME: 'TIME',
  DATE: 'DATE',
  CALCULATE: 'CALCULATE',
  UNIT_CONVERSION: 'UNIT_CONVERSION',
  LOCATION: 'LOCATION',
  INTERNET_CAPABILITY_EXPLANATION: 'INTERNET_CAPABILITY_EXPLANATION',
  DASHBOARD_HELP: 'DASHBOARD_HELP',
  NONE: 'NONE'
};

function normalize(text = '') {
  return naturalRouter.normalizeInputForRouting(String(text || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPunctuation(text = '') {
  return String(text || '').replace(/[?!.,;:]+$/g, '').trim();
}

function isGreeting(text = '') {
  return /^(halo|hai|hi|hello|pagi|siang|sore|malam|ok|oke|sip|makasih|terima kasih)$/i.test(normalize(text));
}

function detectInternetCapability(text = '') {
  const lower = normalize(text).toLowerCase();
  return /(?:supaya|agar|biar).*online.*(?:gimana|bagaimana|caranya)|bot.*(?:bisa|dapat).*akses internet|kenapa.*(?:tidak|nggak|gak).*internet|cara.*aktifkan.*internet|kenapa.*cuaca.*(?:tidak|nggak|gak).*real[-\s]?time|internet.*(?:aktif|online|akses)/i.test(lower);
}

function detectDashboardHelp(text = '') {
  const lower = normalize(text).toLowerCase();
  return /dashboard.*(?:dimana|di mana|mana|lihat|akses|login|disabled|dinonaktifkan|token|konfigurasi|error|gagal)|cara.*(?:lihat|cek|buka|akses).*dashboard|cara.*cek.*health.*bot|cara.*lihat.*(?:memory|graph|reliability)|cara.*cek.*env|token.*(?:belum|tidak).*konfigurasi/i.test(lower);
}

function extractWeatherCity(text = '') {
  let city = stripPunctuation(normalize(text))
    .replace(/\b(bagaimana|gimana|info|cek|lihat|mau|tolong|dong|sekarang|hari ini)\b/gi, ' ')
    .replace(/\b(cuaca|weather|suhu|temperatur|hujan|kondisi)\b/gi, ' ')
    .replace(/\b(di|kota|untuk|daerah|wilayah)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return city;
}

function extractSearchQuery(text = '') {
  let query = stripPunctuation(normalize(text))
    .replace(/\b(tolong|dong|coba|mohon)\b/gi, ' ')
    .replace(/\b(cari|search|google|riset|rangkum|ringkas|summary)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return query;
}

function extractTimeLocation(text = '') {
  const lower = normalize(text).toLowerCase();
  if (/\d+(?:[.,]\d+)?\s+(jam|hari|menit|minggu|bulan|tahun|detik)\b/i.test(lower)) return '';
  return stripPunctuation(normalize(text))
    .replace(/\b(jam|waktu|pukul|berapa|sekarang|hari ini|di)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'jakarta';
}

function extractLocationQuery(text = '') {
  return stripPunctuation(normalize(text))
    .replace(/\b(alamat|lokasi|dimana|di mana|cari tempat|tempat|di)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectNaturalToolIntent(text = '') {
  const clean = normalize(text);
  const lower = clean.toLowerCase();
  if (!clean || clean.startsWith('/') || isGreeting(clean)) {
    return { intent: INTENTS.NONE, confidence: 0, reason: 'empty_command_or_greeting' };
  }

  if (detectDashboardHelp(clean)) {
    return { intent: INTENTS.DASHBOARD_HELP, confidence: 0.82, reason: 'dashboard_help' };
  }

  if (detectInternetCapability(clean)) {
    return { intent: INTENTS.INTERNET_CAPABILITY_EXPLANATION, confidence: 0.88, reason: 'internet_capability_question' };
  }

  const conversion = naturalRouter.detectUnitConversion(clean);
  if (conversion) {
    return { intent: INTENTS.UNIT_CONVERSION, confidence: 0.98, reason: 'unit_conversion', conversion };
  }

  if (naturalRouter.isPureMathExpression(clean)) {
    return {
      intent: INTENTS.CALCULATE,
      confidence: 0.96,
      reason: 'pure_math',
      expression: naturalRouter.extractPureMathExpression(clean)
    };
  }

  if (/\b(cuaca|weather|suhu|temperatur|hujan)\b/i.test(lower)) {
    const city = extractWeatherCity(clean);
    return { intent: INTENTS.WEATHER, confidence: city ? 0.88 : 0.72, reason: 'weather_keyword', city };
  }

  const isTime = /\b(jam|waktu|pukul)\b/i.test(lower) &&
    !/\d+(?:[.,]\d+)?\s+(jam|hari|menit|minggu|bulan|tahun|detik)\b/i.test(lower) &&
    /\b(berapa|sekarang|pukul|di)\b/i.test(lower);
  if (isTime) {
    return { intent: INTENTS.TIME, confidence: 0.78, reason: 'time_question', location: extractTimeLocation(clean) };
  }

  if (/\btanggal\b/i.test(lower) && /\b(berapa|hari ini|sekarang)\b/i.test(lower)) {
    return { intent: INTENTS.DATE, confidence: 0.78, reason: 'date_question' };
  }

  if (/\b(alamat|lokasi|dimana|di mana|cari tempat)\b/i.test(lower)) {
    const query = extractLocationQuery(clean);
    return { intent: INTENTS.LOCATION, confidence: query ? 0.78 : 0.55, reason: 'location_question', query };
  }

  const searchSignal = /\b(cari|search|google|berita|terbaru|update|riset|sumber|rangkum|ringkas)\b/i.test(lower);
  const knowledgeQuestion = /^(apa itu|siapa|kapan|kenapa|bagaimana).*(terbaru|berita|update|sumber)/i.test(lower);
  if (searchSignal || knowledgeQuestion) {
    const query = extractSearchQuery(clean);
    return { intent: INTENTS.WEB_SEARCH, confidence: query ? 0.76 : 0.55, reason: 'search_keyword', query };
  }

  return { intent: INTENTS.NONE, confidence: 0.1, reason: 'no_tool_match' };
}

module.exports = {
  INTENTS,
  detectNaturalToolIntent,
  extractLocationQuery,
  extractSearchQuery,
  extractTimeLocation,
  extractWeatherCity,
  normalize
};
