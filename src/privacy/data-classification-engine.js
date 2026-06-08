'use strict';

const dataInv = require('./data-inventory-scanner');

const SECRET_PATTERNS = [/token/i, /secret/i, /password/i, /api[_-]?key/i, /Authorization/i, /Bearer\s+\S+/, /DATABASE_URL/, /REDIS_URL/, /postgresql:\/\//, /rediss?:\/\//, /\bsk-\w{5,}/, /\bghp_\w{5,}/, /\bgithub_pat_\w{5,}/, /\bgsk_\w{5,}/, /\btvly_\w{5,}/];

function classifyDataCategory(category) {
  const meta = dataInv.CATEGORIES[category];
  if (!meta) return 'internal';
  return meta.sensitivity;
}

function classifyRecordSensitivity(record) {
  if (!record || typeof record !== 'object') return 'internal';
  const text = JSON.stringify(record);
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(text)) return 'secret_blocked';
  }
  if (text.includes('mood') || text.includes('energy') || text.includes('private_note')) return 'sensitive';
  return 'private';
}

function detectSensitivePersonalData(record) {
  if (!record) return false;
  const text = JSON.stringify(record).toLowerCase();
  return text.includes('mood') || text.includes('energy') || text.includes('emotion') || text.includes('feeling') || text.includes('private');
}

function detectSecretBlockedData(record) {
  if (!record) return false;
  const text = JSON.stringify(record);
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(text)) return true;
  }
  return false;
}

function buildClassificationSummary(results) {
  const counts = { public: 0, internal: 0, private: 0, sensitive: 0, secret_blocked: 0 };
  for (const r of (results || [])) {
    if (counts[r.classification] !== undefined) counts[r.classification]++;
  }
  return { total: (results || []).length, counts };
}

module.exports = {
  classifyDataCategory,
  classifyRecordSensitivity,
  detectSensitivePersonalData,
  detectSecretBlockedData,
  buildClassificationSummary
};
