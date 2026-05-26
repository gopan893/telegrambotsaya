'use strict';

const observability = require('../agents/observability');
const { chunkText } = require('./file-handler');

/**
 * Document Parser (Phase 7)
 * Menangani parsing PDF, teks, Markdown, dan dokumen panjang.
 * Mengimplementasikan Smart Chunking, Semantic Extraction, dan Summarization Pipeline.
 * 
 * CATATAN: Untuk parsing PDF asli dibutuhkan pustaka `pdf-parse`.
 * Jika belum terinstall, sistem menggunakan fallback berbasis teks.
 */

/**
 * Mencoba mem-parse konten PDF menggunakan pdf-parse (lazy load)
 * @param {Buffer} fileBuffer
 * @returns {Promise<string>}
 */
async function parsePDF(fileBuffer) {
  try {
    // Lazy load agar tidak membebani RAM kalau tidak ada file PDF
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fileBuffer, {
      max: 5 // Maksimal 5 halaman (hemat RAM & token)
    });
    return data.text || '';
  } catch (err) {
    // Jika pdf-parse belum terinstall atau file corrupt
    return `[FALLBACK] Tidak dapat mem-parse PDF secara langsung: ${err.message}. Kirimkan sebagai teks biasa jika memungkinkan.`;
  }
}

/**
 * Parse dokumen teks biasa (.txt, .md, .rtf)
 * @param {Buffer|string} content
 * @returns {string}
 */
function parsePlainDocument(content) {
  if (Buffer.isBuffer(content)) {
    return content.toString('utf8');
  }
  return String(content || '');
}

/**
 * Mengekstrak poin-poin penting dari teks dokumen (Semantic Extraction)
 */
function extractKeyPoints(text, maxPoints = 8) {
  if (!text) return [];

  const sentences = text
    .split(/[.\n!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 500);

  // Prioritaskan kalimat yang mengandung kata kunci penting
  const importantWords = ['penting', 'harus', 'wajib', 'kesimpulan', 'tujuan', 'masalah', 'solusi',
    'hasil', 'temuan', 'rekomendasi', 'catatan', 'perhatian', 'risiko'];

  const scored = sentences.map(s => {
    const lower = s.toLowerCase();
    let score = 0;
    for (const w of importantWords) {
      if (lower.includes(w)) score += 3;
    }
    // Kalimat di awal dokumen biasanya lebih informatif
    score += Math.max(0, 5 - sentences.indexOf(s));
    return { text: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPoints).map(s => s.text);
}

/**
 * Membuat ringkasan terstruktur dari dokumen
 */
function summarizeDocument(traceId, rawText, fileName) {
  observability.logEvent(traceId, 'DocumentParser', 'SUMMARIZE_START', { fileName, textLength: rawText?.length });

  const chunks = chunkText(rawText);
  const keyPoints = extractKeyPoints(rawText);

  const summary = {
    fileName: fileName || 'unknown',
    totalCharacters: (rawText || '').length,
    totalChunks: chunks.length,
    keyPoints,
    preview: (rawText || '').substring(0, 500),
    truncated: chunks.length > 1
  };

  observability.logEvent(traceId, 'DocumentParser', 'SUMMARIZE_COMPLETE', {
    keyPointsCount: keyPoints.length
  });

  return summary;
}

module.exports = {
  parsePDF,
  parsePlainDocument,
  extractKeyPoints,
  summarizeDocument
};
