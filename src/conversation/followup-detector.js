'use strict';

const guards = require('./conversation-guards');

const AFFIRM = new Set([
  'iya', 'ya', 'y', 'yes', 'ok', 'oke', 'okay', 'boleh', 'lanjut boleh',
  'silakan', 'gas', 'setuju', 'benar', 'betul'
]);

const DENY = new Set([
  'tidak', 'nggak', 'gak', 'ga', 'no', 'nope', 'jangan', 'batal',
  'cancel', 'stop', 'udah', 'cukup', 'tidak usah'
]);

const CONTINUE = new Set([
  'lanjut', 'lanjutkan', 'terus', 'next', 'continue', 'boleh lanjut',
  'jelaskan', 'detail', 'lebih detail', 'terangkan', 'bahas',
  'kenapa', 'mengapa', 'maksudnya', 'kok bisa'
]);

const REFERENTIAL = [
  'itu', 'ini', 'yang tadi', 'tadi', 'tersebut', 'bagian itu',
  'yang pertama', 'yang kedua', 'yang terakhir', 'that', 'this',
  'the previous', 'previous one'
];

function normalizeShort(text) {
  return guards.safeLower(text)
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isShortReply(text) {
  const clean = guards.safeText(text);
  return clean.length <= 32 && clean.split(/\s+/).length <= 5;
}

function detect(text) {
  const clean = normalizeShort(text);
  const short = isShortReply(text);

  if (!clean) {
    return { kind: 'empty', short, confidence: 1, reason: 'empty_message' };
  }

  if (DENY.has(clean)) {
    return { kind: clean === 'batal' || clean === 'cancel' || clean === 'stop' ? 'cancel' : 'deny', short, confidence: 0.96, reason: 'short_negative_reply' };
  }

  if (AFFIRM.has(clean)) {
    return { kind: 'affirm', short, confidence: 0.95, reason: 'short_affirmative_reply' };
  }

  if (CONTINUE.has(clean)) {
    return { kind: 'continue', short, confidence: 0.9, reason: 'short_continue_reply' };
  }

  if (short && guards.includesAny(clean, REFERENTIAL)) {
    return { kind: 'referential', short, confidence: 0.82, reason: 'short_referential_reply' };
  }

  if (short && /^(yang|bagian|nomor)\s+\w+/i.test(clean)) {
    return { kind: 'referential', short, confidence: 0.76, reason: 'short_specific_reference' };
  }

  return { kind: 'none', short, confidence: 0.5, reason: 'not_a_simple_followup' };
}

function isFollowupKind(kind) {
  return ['affirm', 'deny', 'cancel', 'continue', 'referential'].includes(kind);
}

module.exports = {
  detect,
  isFollowupKind
};
