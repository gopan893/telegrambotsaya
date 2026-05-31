'use strict';

// =============================================================
// NATURAL TOOL ROUTER — Phase 10 Hotfix 1
// Routes natural chat queries to appropriate tool handlers:
//   - "Cuaca di Tokyo" -> getWeather("Tokyo")
//   - "Cari berita AI terbaru" -> Tavily search
//   - "Supaya bisa online gimana?" -> capability explanation
// =============================================================

const INTENT = {
  WEATHER: 'WEATHER',
  WEB_SEARCH: 'WEB_SEARCH',
  INTERNET_CAPABILITY_EXPLANATION: 'INTERNET_CAPABILITY_EXPLANATION',
  TIME: 'TIME',
  DATE: 'DATE',
  CALCULATE: 'CALCULATE',
  UNIT_CONVERSION: 'UNIT_CONVERSION',
  LOCATION: 'LOCATION',
  NONE: 'NONE'
};

function normalizeToolText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[?!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Weather intent keywords (ID + EN)
const WEATHER_KW = ['cuaca', 'weather', 'suhu', 'temperatur', 'hujan', 'panas', 'dingin', 'ramalan cuaca', 'prakiraan', 'forecast'];

// Explicit search/online queries (not casual greetings)
const SEARCH_KW = ['cari', 'search', 'terbaru', 'berita', 'update', 'riset', 'sumber', 'informasi terkini', 'apa yang terjadi', 'news'];

// Strings that explain internet/online capability
const INTERNET_EXPLAIN_KW = [
  'bisa online', 'akses internet', 'cara online', 'supaya online', 'gimana online',
  'kenapa tidak bisa internet', 'kenapa ga bisa internet', 'aktifkan internet',
  'cuaca tidak real time', 'cuaca tidak realtime', 'kenapa cuaca', 'bot bisa internet',
  'browsing langsung', 'cara aktifkan internet', 'cara agar online'
];

// Calculator patterns — these should NOT be treated as search
const CALC_PATTERN = /^\d+[\d\s+\-*/().%^]*[\d)]$/;
const MATH_WORDS = ['hitung', 'calculate', 'berapa hasil', 'hasil dari'];

// Unit conversion patterns — should NOT be treated as search
const UNIT_PATTERNS = [
  /\d+\s*(jam|hari|menit|detik|minggu|bulan|tahun|km|meter|kg|liter|ml|cm|inch|pound|dollar|euro|rupiah)\s*(berapa|ke|jadi|dalam)/i,
  /\d+\s*(km|m|cm|mm|inch|ft|yard|mile)\b/i,
  /berapa\s+\w+\s+dalam\s+\w+/i
];

// Location keywords
const LOCATION_KW = ['alamat', 'lokasi', 'dimana', 'di mana', 'maps', 'peta', 'petunjuk arah', 'rute', 'jarak ke'];

// Simple greetings that must NOT trigger tool routing
const GREETING_WORDS = [
  'halo', 'hai', 'hi', 'hello', 'pagi', 'siang', 'sore', 'malam', 'hei',
  'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
  'halo bot', 'hei bot', 'halo ai', 'hei ai', 'good morning', 'good evening'
];

function isSimpleGreeting(text) {
  const norm = normalizeToolText(text);
  return GREETING_WORDS.some(g => norm === g || norm === `${g}!` || norm === `${g}.`);
}

function isCalculatorInput(text) {
  const norm = normalizeToolText(text);
  if (CALC_PATTERN.test(norm.replace(/\s/g, ''))) return true;
  if (MATH_WORDS.some(w => norm.includes(w))) return true;
  return false;
}

function isUnitConversion(text) {
  const lower = String(text || '').toLowerCase();
  return UNIT_PATTERNS.some(p => p.test(lower));
}

function shouldUseWeatherTool(text) {
  const norm = normalizeToolText(text);
  return WEATHER_KW.some(kw => norm.includes(kw));
}

function shouldUseWebSearchTool(text) {
  const norm = normalizeToolText(text);
  if (isSimpleGreeting(text)) return false;
  if (isCalculatorInput(text)) return false;
  if (isUnitConversion(text)) return false;
  return SEARCH_KW.some(kw => norm.includes(kw));
}

function shouldExplainInternetCapability(text) {
  const norm = normalizeToolText(text);
  return INTERNET_EXPLAIN_KW.some(kw => norm.includes(kw));
}

/**
 * Extract city name from a weather query.
 * Strips common filler words and returns the city.
 */
function extractWeatherCity(text) {
  let s = String(text || '');
  // Remove all weather keywords and filler
  const fillers = [
    'cuaca', 'weather', 'suhu', 'udara', 'temperatur', 'hujan', 'panas', 'dingin',
    'prakiraan', 'forecast', 'ramalan', 'hari ini', 'besok', 'sekarang',
    'bagaimana', 'bagaimana cuaca', 'seperti apa', 'gimana',
    'di', 'kota', 'untuk', 'pada', 'di kota', 'wilayah', 'daerah'
  ];
  for (const f of fillers) {
    s = s.replace(new RegExp(`\\b${f}\\b`, 'gi'), ' ');
  }
  s = s.replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  // Capitalize first letter of each word (city names)
  if (s.length > 0) {
    return s.split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return '';
}

/**
 * Detect the primary natural tool intent from a user message.
 * Returns one of the INTENT constants.
 */
function detectNaturalToolIntent(text) {
  if (!text || typeof text !== 'string') return INTENT.NONE;
  const norm = normalizeToolText(text);
  if (!norm) return INTENT.NONE;

  // Must not be a simple greeting
  if (isSimpleGreeting(text)) return INTENT.NONE;

  // Calculator (before search, as some math expressions contain numbers)
  if (isCalculatorInput(text) && !shouldUseWeatherTool(text)) return INTENT.CALCULATE;

  // Unit conversion
  if (isUnitConversion(text) && !shouldUseWeatherTool(text)) return INTENT.UNIT_CONVERSION;

  // Internet capability explanation (check before weather/search)
  if (shouldExplainInternetCapability(text)) return INTENT.INTERNET_CAPABILITY_EXPLANATION;

  // Weather (priority over search)
  if (shouldUseWeatherTool(text)) return INTENT.WEATHER;

  // Web search
  if (shouldUseWebSearchTool(text)) return INTENT.WEB_SEARCH;

  // Location
  if (LOCATION_KW.some(kw => norm.includes(kw))) return INTENT.LOCATION;

  return INTENT.NONE;
}

/**
 * Handle the detected natural tool intent and send response.
 * ctx: { chatId, userId, userText, msg }
 * services: { getWeather, summarizeSearchWithRefs, getSystemPrompt, safeSendMessage, sendChunkedMessage }
 * Returns true if handled, false otherwise.
 */
async function handleNaturalToolIntent(ctx, services) {
  const { chatId, userId, userText, msg } = ctx;
  const {
    getWeather,
    summarizeSearchWithRefs,
    getSystemPrompt,
    safeSendMessage,
    sendChunkedMessage,
    opsSystem
  } = services;

  const replyOpt = msg ? { reply_to_message_id: msg.message_id } : {};
  const intent = detectNaturalToolIntent(userText);

  if (intent === INTENT.NONE) return false;

  // Record telemetry if available
  try {
    if (opsSystem && opsSystem.telemetry && typeof opsSystem.telemetry.recordToolUsage === 'function') {
      opsSystem.telemetry.recordToolUsage('natural_tool_router', {
        tool: 'natural_tool_router',
        success: true,
        meta: { intent }
      }, services.opsServices || {});
    }
  } catch (_) {}

  // --- INTERNET CAPABILITY EXPLANATION ---
  if (intent === INTENT.INTERNET_CAPABILITY_EXPLANATION) {
    const msg1 = `Bot ini bisa online melalui tool dan API, bukan model AI yang browsing langsung.

Server bot memanggil API eksternal:
- 🌤️ **OpenWeather API** untuk data cuaca real-time
- 🔍 **Tavily Search API** untuk pencarian berita dan informasi terkini

AI menerima hasil dari API tersebut, lalu merangkumnya menjadi jawaban.

Untuk mengaktifkan:
- Set \`OPENWEATHER_API_KEY\` di environment Render
- Set \`TAVILY_API_KEY\` di environment Render
- Redeploy setelah menyimpan env vars`;
    await safeSendMessage(chatId, msg1, replyOpt);
    return true;
  }

  // --- WEATHER ---
  if (intent === INTENT.WEATHER) {
    const city = extractWeatherCity(userText);
    if (!city) {
      await safeSendMessage(chatId, 'Sebutkan nama kota. Contoh: "Cuaca di Tokyo"', replyOpt);
      return true;
    }

    const hasKey = Boolean(process.env.OPENWEATHER_API_KEY);
    if (!hasKey) {
      await safeSendMessage(chatId, `⚠️ Fitur cuaca real-time belum aktif karena OPENWEATHER_API_KEY belum diset di environment.

Untuk mengaktifkan, set \`OPENWEATHER_API_KEY\` di Render lalu redeploy.`, replyOpt);
      return true;
    }

    try {
      const weatherResult = await getWeather(city);
      await safeSendMessage(chatId, weatherResult, replyOpt);
      // Record success telemetry
      try {
        if (opsSystem?.telemetry?.recordToolUsage) {
          opsSystem.telemetry.recordToolUsage('weather_tool', {
            tool: 'weather_tool',
            success: true,
            meta: { city: city.slice(0, 40) }
          }, services.opsServices || {});
        }
      } catch (_) {}
    } catch (err) {
      await safeSendMessage(chatId, `❌ Gagal mengambil data cuaca untuk "${city}". Coba lagi sebentar.`, replyOpt);
      try {
        if (opsSystem?.telemetry?.recordToolUsage) {
          opsSystem.telemetry.recordToolUsage('weather_tool', {
            tool: 'weather_tool',
            success: false,
            error: err.message,
            meta: { city: city.slice(0, 40) }
          }, services.opsServices || {});
        }
      } catch (_) {}
    }
    return true;
  }

  // --- WEB SEARCH ---
  if (intent === INTENT.WEB_SEARCH) {
    const hasKey = Boolean(process.env.TAVILY_API_KEY);
    if (!hasKey) {
      await safeSendMessage(chatId, `⚠️ Fitur pencarian internet belum aktif karena TAVILY_API_KEY belum diset di environment.

Untuk mengaktifkan, set \`TAVILY_API_KEY\` di Render lalu redeploy.`, replyOpt);
      return true;
    }

    // Strip common search trigger words to get clean query
    let query = userText;
    const strip = ['cari', 'search', 'berita', 'terbaru', 'riset', 'sumber', 'google', 'update', 'informasi terkini', 'apa yang terjadi', 'di', 'ke', 'tentang', 'untuk'];
    for (const kw of strip) {
      query = query.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ');
    }
    query = query.replace(/\s+/g, ' ').trim();

    if (!query || query.length < 3) {
      await safeSendMessage(chatId, 'Apa yang ingin kamu cari? Contoh: "Cari berita AI terbaru"', replyOpt);
      return true;
    }

    try {
      const systemPrompt = typeof getSystemPrompt === 'function' ? getSystemPrompt(userId) : '';
      const result = await summarizeSearchWithRefs(query, userId, systemPrompt);
      await sendChunkedMessage(chatId, result, replyOpt);
      try {
        if (opsSystem?.telemetry?.recordToolUsage) {
          opsSystem.telemetry.recordToolUsage('search_tool', {
            tool: 'search_tool',
            success: true,
            meta: { queryLen: query.length }
          }, services.opsServices || {});
        }
      } catch (_) {}
    } catch (err) {
      await safeSendMessage(chatId, `❌ Gagal melakukan pencarian. Coba lagi sebentar.`, replyOpt);
      try {
        if (opsSystem?.telemetry?.recordToolUsage) {
          opsSystem.telemetry.recordToolUsage('search_tool', {
            tool: 'search_tool',
            success: false,
            error: err.message
          }, services.opsServices || {});
        }
      } catch (_) {}
    }
    return true;
  }

  return false;
}

module.exports = {
  INTENT,
  normalizeToolText,
  detectNaturalToolIntent,
  extractWeatherCity,
  shouldUseWeatherTool,
  shouldUseWebSearchTool,
  shouldExplainInternetCapability,
  handleNaturalToolIntent
};
