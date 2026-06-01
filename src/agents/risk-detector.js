'use strict';

const { containsSecretLike, maskSecret, textIncludesAny } = require('./agent-utils');

function detectSecretLikeContent(message) {
  return containsSecretLike(String(message?.text || message || ''));
}

function detectActionRequest(message) {
  return /\b(jalankan|menjalankan|eksekusi|run|approve|set webhook|restore|import|hapus|delete|kirim|ubah permission)\b/i.test(String(message?.text || message || ''));
}

function detectWriteOrExternalIntent(message) {
  return /\b(restore|import|overwrite|hapus|delete|jalankan|menjalankan|eksekusi|run|set env|set webhook|kirim email|external api)\b/i.test(String(message?.text || message || ''));
}

function detectDangerIntent(message) {
  return /\b(restore|import overwrite|hapus semua|delete all|drop table|shell|terminal|api key|token|database_url|redis_url|permission admin)\b/i.test(String(message?.text || message || ''));
}

function detectMessageRisk(message, topics = [], context = {}, services = {}) {
  const text = String(message?.text || message || '');
  const secret = detectSecretLikeContent(text);
  const danger = detectDangerIntent(text) || topics.includes('restore') || topics.includes('import') || topics.includes('secret');
  const writeExternal = detectWriteOrExternalIntent(text);
  const action = detectActionRequest(text);
  let level = 'low';
  if (action || writeExternal) level = 'medium';
  if (danger || secret || topics.includes('security')) level = 'high';
  if (secret || textIncludesAny(text, ['drop table', 'hapus semua', 'overwrite production', 'restore backup lama'])) level = 'danger';
  return {
    level,
    riskLevel: level,
    secretDetected: secret,
    actionRequested: action,
    writeOrExternalIntent: writeExternal,
    dangerIntent: danger,
    sanitizedText: maskSecret(text),
    reasons: [
      secret ? 'secret-like content detected' : '',
      danger ? 'danger intent/topic detected' : '',
      writeExternal ? 'write/external intent detected' : '',
      action ? 'action request detected' : ''
    ].filter(Boolean)
  };
}

module.exports = {
  detectActionRequest,
  detectDangerIntent,
  detectMessageRisk,
  detectSecretLikeContent,
  detectWriteOrExternalIntent
};
