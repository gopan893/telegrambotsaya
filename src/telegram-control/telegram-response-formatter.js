'use strict';

const utils = require('./telegram-utils');
const MAX_SHORT_LENGTH = 500;
const MAX_LONG_LENGTH = 3500;
const CHUNK_LIMIT = 4000;

function formatTelegramShortResponse(data) {
  if (!data) return 'Tidak ada data.';
  if (typeof data === 'string') return utils.truncateText(utils.sanitizeText(data), MAX_SHORT_LENGTH);
  if (typeof data === 'object') {
    if (data.text) return utils.truncateText(utils.sanitizeText(data.text), MAX_SHORT_LENGTH);
    if (data.message) return utils.truncateText(utils.sanitizeText(data.message), MAX_SHORT_LENGTH);
    try {
      const safe = utils.sanitizeText(JSON.stringify(data, null, 2));
      return utils.truncateText(safe, MAX_SHORT_LENGTH);
    } catch (_) {
      return 'Data tidak dapat ditampilkan.';
    }
  }
  return utils.truncateText(utils.sanitizeText(String(data)), MAX_SHORT_LENGTH);
}

function formatTelegramLongResponse(data) {
  if (!data) return 'Tidak ada data.';
  if (typeof data === 'string') return utils.sanitizeText(data);
  if (typeof data === 'object') {
    if (data.text) return utils.sanitizeText(data.text);
    if (data.message) return utils.sanitizeText(data.message);
    try {
      return utils.sanitizeText(JSON.stringify(data, null, 2));
    } catch (_) {
      return 'Data tidak dapat ditampilkan.';
    }
  }
  return utils.sanitizeText(String(data));
}

function formatTelegramListResponse(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return 'Tidak ada item.';
  }

  const lines = items.map((item, index) => {
    if (typeof item === 'string') return `${index + 1}. ${item}`;
    const name = item.name || item.title || item.id || `Item ${index + 1}`;
    const desc = item.description || item.summary || '';
    const status = item.status ? ` [${item.status}]` : '';
    return `${index + 1}. ${name}${status}${desc ? ': ' + desc : ''}`;
  });

  return utils.sanitizeText(lines.join('\n'));
}

function formatTelegramErrorResponse(error) {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.';
  const message = error.message || error.error || error.reason || String(error);
  const sanitized = utils.sanitizeText(message);
  return `❌ *Error*\n${utils.truncateText(sanitized, MAX_SHORT_LENGTH)}`;
}

function formatTelegramProposalResponse(proposal) {
  if (!proposal) return 'Tidak ada proposal.';
  const riskEmoji = { read_only: '📖', low: '🟢', medium: '🟡', high: '🟠', danger: '🔴' };

  const lines = [
    `📋 *Proposal*`,
    `ID: \`${proposal.id}\``,
    `Perintah: \`/${proposal.command}\``,
    `Tindakan: ${proposal.action || proposal.command}`,
    `Tingkat Risiko: ${riskEmoji[proposal.riskLevel] || '⚪'} ${proposal.riskLevel}`,
    `Status: ${proposal.status}`,
    '',
    `Gunakan /approve ${proposal.id} untuk menyetujui.`,
    `Gunakan /reject ${proposal.id} untuk menolak.`,
    `Setelah disetujui, gunakan /runexec ${proposal.id} untuk menjalankan.`
  ];

  return utils.sanitizeText(lines.join('\n'));
}

function sanitizeTelegramResponse(text) {
  return utils.sanitizeText(String(text || ''));
}

function chunkTelegramResponse(text) {
  const sanitized = utils.sanitizeText(String(text || ''));
  if (sanitized.length <= CHUNK_LIMIT) return [sanitized];
  return utils.chunkArray(sanitized.split('\n'), 80).map(chunk => chunk.join('\n'));
}

module.exports = {
  formatTelegramShortResponse,
  formatTelegramLongResponse,
  formatTelegramListResponse,
  formatTelegramErrorResponse,
  formatTelegramProposalResponse,
  sanitizeTelegramResponse,
  chunkTelegramResponse
};
