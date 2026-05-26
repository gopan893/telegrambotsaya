'use strict';

const path = require('path');
const crypto = require('crypto');
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
const MAX_CONTEXT_CHUNKS = 6;

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
function validateFileSafety(fileSize = 0, contentType) {
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

function createContentHash(input) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''), 'utf8');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function inspectFileIntegrity(fileBuffer, contentType, fileName) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    return {
      ok: false,
      reason: 'NO_FILE_BUFFER',
      hash: null,
      size: 0
    };
  }

  const size = fileBuffer.length;
  const hash = createContentHash(fileBuffer);
  const ext = path.extname(fileName || '').toLowerCase();
  const signature = fileBuffer.slice(0, 8).toString('hex');
  let ok = size > 0;
  let reason = ok ? null : 'EMPTY_FILE';

  if (contentType === 'pdf' && signature.slice(0, 8) !== '25504446') {
    ok = false;
    reason = 'PDF_SIGNATURE_MISMATCH';
  }
  if (contentType === 'image') {
    const knownImage = signature.startsWith('ffd8ff') || signature.startsWith('89504e47') || signature.startsWith('47494638') || signature.startsWith('52494646');
    if (!knownImage && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      ok = false;
      reason = 'IMAGE_SIGNATURE_MISMATCH';
    }
  }

  return { ok, reason, hash, size, signature: signature.slice(0, 12) };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f\u3040-\u30ff\u4e00-\u9fff]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);
}

function scoreTextRelevance(query, text) {
  const queryWords = [...new Set(tokenize(query))];
  if (!queryWords.length) return 0.5;
  const lowerText = String(text || '').toLowerCase();
  const matches = queryWords.filter((word) => lowerText.includes(word)).length;
  return Math.max(0.1, Math.min(1, 0.25 + (matches / queryWords.length) * 0.75));
}

function inferSemanticTags(text, contentType, fileName) {
  const lower = `${fileName || ''}\n${text || ''}`.toLowerCase();
  const tags = new Set([contentType]);
  const patterns = [
    ['finance', ['harga', 'biaya', 'revenue', 'profit', 'uang', 'keuangan']],
    ['education', ['belajar', 'materi', 'kelas', 'kurikulum', 'latihan']],
    ['technical', ['api', 'kode', 'node', 'database', 'server', 'error', 'deploy']],
    ['planning', ['roadmap', 'jadwal', 'target', 'milestone', 'rencana']],
    ['risk', ['risiko', 'masalah', 'ancaman', 'gagal', 'warning']],
    ['research', ['sumber', 'bukti', 'metode', 'hasil', 'kesimpulan']]
  ];

  for (const [tag, words] of patterns) {
    if (words.some((word) => lower.includes(word))) tags.add(tag);
  }

  return Array.from(tags).slice(0, 8);
}

function createSourceCitations(fileName, chunks) {
  return chunks.map((chunk, index) => ({
    id: `file:${index + 1}`,
    label: `${fileName || 'file'}#chunk-${index + 1}`,
    chunkIndex: index,
    preview: String(chunk || '').replace(/\s+/g, ' ').trim().slice(0, 220)
  }));
}

function compressFileContext(query, chunks, maxChunks = 3) {
  return chunks
    .map((chunk, index) => ({
      chunk,
      index,
      score: scoreTextRelevance(query, chunk)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .sort((a, b) => a.index - b.index)
    .map((item) => ({
      id: `file:${item.index + 1}`,
      text: item.chunk,
      score: item.score
    }));
}

/**
 * Membuat file ID unik untuk deduplication dan caching
 */
function generateFileId(fileName, fileSize, contentHash = '') {
  return `file_${fileName}_${fileSize}_${contentHash}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 140);
}

/**
 * Membuat ringkasan konteks dari file yang sudah diparsing
 */
function buildFileContext(traceId, contentType, extractedText, fileName, options = {}) {
  observability.logEvent(traceId, 'FileHandler', 'BUILD_FILE_CONTEXT', { contentType, fileName });

  const chunks = chunkText(extractedText);
  // Hanya ambil chunk pertama untuk konteks utama (hemat token)
  const primaryChunk = chunks[0] || '';
  const totalChunks = chunks.length;
  const limitedChunks = chunks.slice(0, MAX_CONTEXT_CHUNKS);
  const citations = createSourceCitations(fileName, limitedChunks);
  const semanticTags = inferSemanticTags(extractedText, contentType, fileName);
  const confidence = options.confidence ?? (primaryChunk ? 0.72 : 0.25);

  return {
    contentType,
    fileName: fileName || 'unknown',
    primaryContent: primaryChunk,
    chunks: limitedChunks,
    compressedContext: compressFileContext(options.query || '', limitedChunks, 3),
    sourceCitations: citations,
    sourceAttribution: citations.map((c) => c.label),
    semanticTags,
    confidence,
    evidenceScore: options.evidenceScore ?? confidence,
    integrity: options.integrity || null,
    keyPoints: options.keyPoints || [],
    facts: options.facts || [],
    inferences: options.inferences || [],
    warnings: options.warnings || [],
    limitations: options.limitations || null,
    groundingHint: 'Jawab hanya berdasarkan sourceCitations dan sebutkan jika bagian file tidak terbaca.',
    totalChunks,
    fullLength: (extractedText || '').length,
    truncated: totalChunks > 1,
    hash: options.hash || createContentHash(extractedText || fileName || ''),
    extractedAt: Date.now()
  };
}

module.exports = {
  classifyContentType,
  validateFileSafety,
  inspectFileIntegrity,
  chunkText,
  compressFileContext,
  createContentHash,
  createSourceCitations,
  inferSemanticTags,
  scoreTextRelevance,
  generateFileId,
  buildFileContext,
  MAX_FILE_SIZE_BYTES,
  MAX_CHUNK_SIZE,
  MAX_CONTEXT_CHUNKS
};
