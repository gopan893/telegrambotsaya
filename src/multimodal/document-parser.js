'use strict';

const observability = require('../agents/observability');
const { chunkText, createSourceCitations, scoreTextRelevance } = require('./file-handler');

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

function extractFactsAndInferences(text, maxItems = 8) {
  const sentences = String(text || '')
    .split(/[.\n!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500);

  const facts = [];
  const inferences = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (/\d/.test(sentence) || lower.includes('adalah') || lower.includes('terdiri dari') || lower.includes('hasil')) {
      facts.push(sentence);
    } else if (lower.includes('mungkin') || lower.includes('kemungkinan') || lower.includes('dapat') || lower.includes('sebaiknya')) {
      inferences.push(sentence);
    }
    if (facts.length >= maxItems && inferences.length >= maxItems) break;
  }

  return {
    facts: facts.slice(0, maxItems),
    inferences: inferences.slice(0, maxItems)
  };
}

function buildDocumentAnalysis(traceId, rawText, fileName, query = '') {
  const text = String(rawText || '');
  const chunks = chunkText(text);
  const keyPoints = extractKeyPoints(text);
  const extracted = extractFactsAndInferences(text);
  const citations = createSourceCitations(fileName, chunks.slice(0, 6));
  const readable = text.trim().length > 40 && !text.startsWith('[FALLBACK]');
  const relevance = scoreTextRelevance(query, text);
  const confidence = readable ? Math.max(0.45, Math.min(0.92, 0.55 + relevance * 0.35)) : 0.22;
  const warnings = [];

  if (!readable) warnings.push('Dokumen tidak terbaca penuh atau parser memakai fallback.');
  if (chunks.length > 6) warnings.push('Dokumen panjang; hanya chunk paling relevan yang dimasukkan ke prompt.');
  if (text.length < 120) warnings.push('Konten dokumen sangat pendek, confidence analisis terbatas.');

  observability.logEvent(traceId, 'DocumentParser', 'DOCUMENT_ANALYSIS_BUILT', {
    fileName,
    chunks: chunks.length,
    confidence,
    warningCount: warnings.length
  });

  return {
    keyPoints,
    facts: extracted.facts,
    inferences: extracted.inferences,
    citations,
    confidence,
    evidenceScore: Math.max(0.2, Math.min(1, (keyPoints.length / 8) * 0.4 + confidence * 0.6)),
    limitations: warnings.join(' ') || null,
    warnings
  };
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
  extractFactsAndInferences,
  buildDocumentAnalysis,
  summarizeDocument
};
