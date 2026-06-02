'use strict';

const utils = require('./decision-utils');

function splitExplicitOptions(message = '') {
  const text = String(message || '').trim();
  const pipe = text.split('|').map(item => item.trim()).filter(Boolean);
  if (pipe.length >= 2) return pipe.slice(0, 4);
  const vs = text.match(/(.+?)\s+(?:vs|versus)\s+(.+)/i);
  if (vs) return [vs[1], vs[2]].map(cleanOptionText);
  const atau = text.match(/(?:lebih\s+baik|mending|pilih)?\s*(.+?)\s+atau\s+(.+?)(?:\?|$)/i);
  if (atau) return [atau[1], atau[2]].map(cleanOptionText);
  return [];
}

function cleanOptionText(text = '') {
  return utils.sanitizeDecisionText(String(text || '')
    .replace(/^(lebih\s+baik|mending|pilih|apakah|saya\s+harus|harus|sebaiknya)\s+/i, '')
    .replace(/\?+$/g, '')
    .trim(), { max: 160 });
}

function inferImplicitOptions(message = '', context = {}, services = {}) {
  const text = String(message || '').toLowerCase();
  if (/10 bot|4 bot|bot langsung|multi-bot/.test(text)) {
    return [
      'Tambah 10 bot langsung',
      'Mulai dari 4 bot inti dulu',
      'Tambah bertahap 4 → 7 → 10'
    ];
  }
  if (/phase|lanjut|roadmap/.test(text)) {
    return [
      'Lanjut ke phase berikutnya yang paling logis',
      'Stabilisasi dan regression test dulu',
      'Tunda keputusan sampai scope lebih jelas'
    ];
  }
  if (/postgres|json|redis|storage/.test(text)) {
    return [
      'Gunakan PostgreSQL sebagai primary storage',
      'Gunakan JSON fallback saja',
      'Gunakan PostgreSQL + JSON fallback compatibility'
    ];
  }
  if (/restore|import|backup/.test(text)) {
    return [
      'Restore langsung',
      'Buat restore plan, validasi checksum/integrity, lalu approval',
      'Tunda restore dan export summary dulu'
    ];
  }
  if (/capek|lelah|pusing|coding|istirahat/.test(text)) {
    return [
      'Istirahat singkat dulu',
      'Kerjakan satu task kecil maksimal 30 menit',
      'Tunda coding berat sampai energi pulih'
    ];
  }
  return [
    'Ambil langkah kecil yang reversible',
    'Kumpulkan informasi tambahan dulu',
    'Tunda keputusan besar sampai risiko jelas'
  ];
}

function normalizeOptions(options = []) {
  const seen = new Set();
  return options
    .map((option, index) => typeof option === 'string' ? { label: option } : option)
    .map((option, index) => utils.buildOption(option, index))
    .filter(option => {
      const key = option.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(option.label);
    })
    .slice(0, 4);
}

function validateOptions(options = []) {
  const normalized = normalizeOptions(options);
  return {
    ok: normalized.length >= 2,
    options: normalized,
    error: normalized.length >= 2 ? '' : 'INSUFFICIENT_OPTIONS'
  };
}

function addFallbackOptions(question = '', context = {}) {
  return normalizeOptions(inferImplicitOptions(question, context));
}

function extractOptionsFromMessage(message = '', context = {}, services = {}) {
  const explicit = splitExplicitOptions(message);
  let options = explicit.length >= 2 ? explicit : inferImplicitOptions(message, context, services);
  if (options.length < 2) options = addFallbackOptions(message, context);
  const normalized = normalizeOptions(options);
  const lowInfo = !explicit.length && !/\b(phase|bot|postgres|json|restore|backup|coding|istirahat)\b/i.test(message);
  if (lowInfo && !normalized.some(option => /informasi|tunda|defer/i.test(option.label))) {
    normalized.push(utils.buildOption({ label: 'Kumpulkan informasi tambahan dulu', category: 'defer' }, normalized.length));
  }
  return normalized.slice(0, 4);
}

module.exports = {
  addFallbackOptions,
  extractOptionsFromMessage,
  inferImplicitOptions,
  normalizeOptions,
  validateOptions
};
