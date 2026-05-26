'use strict';

const path = require('path');
const observability = require('../agents/observability');

/**
 * Multimodal File Handler (Phase 7)
 * Content Type Classifier, Smart Content Routing, Safe File Handling.
 * Bertindak sebagai gerbang utama untuk semua attachment yang masuk dari Telegram.
 */

// Batas ukuran file aman untuk Render free tier (5 MB)
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Chunk size maksimal saat ekstraksi teks (4000 karakter)
const MAX_CHUNK_SIZE = 4000;

/**
 * Klasifikasi MIME type dari ekstensi file Telegram
 */
function classifyContentType(fileName, mimeType) {
  const ext = path.extname(fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  // Image
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext) || mime.startsWith('image/')) {
    return 'image';
  }

  // PDF
  if (ext === '.pdf' || mime === 'application/pdf') {
    return 'pdf';
  }

  // Spreadsheet
  if (['.xlsx', '.xls', '.csv', '.tsv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('csv')) {
    return 'spreadsheet';
  }

  // Document
  if (['.doc', '.docx', '.txt', '.md', '.rtf'].includes(ext) || mime.includes('document') || mime.includes('text/plain')) {
    return 'document';
  }

  // Audio (Transcription support placeholder)
  if (['.mp3', '.wav', '.ogg', '.m4a', '.oga'].includes(ext) || mime.startsWith('audio/')) {
    return 'audio';
  }

  // JSON / Structured Data
  if (ext === '.json' || mime === 'application/json') {
    return 'json';
  }

  return 'unknown';
}

/**
 * Memeriksa apakah file aman untuk diproses (ukuran, tipe)
 * @returns {{ safe: boolean, reason: string|null }}
 */
function validateFileSafety(fileSize, contentType) {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { safe: false, reason: `OVERSIZED_FILE (${(fileSize / 1024 / 1024).toFixed(1)} MB melebihi batas ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)` };
  }

  if (contentType === 'unknown') {
    return { safe: false, reason: 'UNSUPPORTED_FORMAT' };
  }

  return { safe: true, reason: null };
}

/**
 * Memecah teks panjang menjadi chunks agar tidak membebani context window LLM
 */
function chunkText(text, maxChunkSize = MAX_CHUNK_SIZE) {
  if (!text || text.length <= maxChunkSize) return [text || ''];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);
    // Coba potong di batas paragraf/baris terdekat
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start + maxChunkSize * 0.5) {
        end = lastNewline + 1;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * Membuat file ID unik untuk deduplication dan caching
 */
function generateFileId(fileName, fileSize) {
  return `file_${fileName}_${fileSize}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Membuat ringkasan konteks dari file yang sudah diparsing
 */
function buildFileContext(traceId, contentType, extractedText, fileName) {
  observability.logEvent(traceId, 'FileHandler', 'BUILD_FILE_CONTEXT', { contentType, fileName });

  const chunks = chunkText(extractedText);
  // Hanya ambil chunk pertama untuk konteks utama (hemat token)
  const primaryChunk = chunks[0] || '';
  const totalChunks = chunks.length;

  return {
    contentType,
    fileName: fileName || 'unknown',
    primaryContent: primaryChunk,
    totalChunks,
    fullLength: (extractedText || '').length,
    truncated: totalChunks > 1,
    extractedAt: Date.now()
  };
}

module.exports = {
  classifyContentType,
  validateFileSafety,
  chunkText,
  generateFileId,
  buildFileContext,
  MAX_FILE_SIZE_BYTES,
  MAX_CHUNK_SIZE
};
