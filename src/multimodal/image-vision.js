'use strict';

const observability = require('../agents/observability');

/**
 * Image Vision Pipeline (Phase 7)
 * Mengelola Image Captioning, Visual Analysis, dan OCR Fallback.
 * Menyediakan antarmuka untuk LLM multimodal (Gemini Vision / GPT-4o).
 * 
 * CATATAN: Modul ini menyiapkan *interface* agar mudah dihubungkan
 * ke API Vision yang tersedia di bot Anda. Jika API belum dikonfigurasi,
 * sistem menggunakan fallback deskriptif.
 */

/**
 * Menganalisis gambar menggunakan LLM multimodal (jika tersedia)
 * @param {string} traceId
 * @param {Buffer|string} imageData - Buffer gambar atau URL
 * @param {string} userQuery - Pertanyaan user terkait gambar
 * @param {object} botServices - Layanan bot (termasuk callLLM jika ada)
 * @returns {Promise<object>} Hasil analisis visual
 */
async function analyzeImage(traceId, imageData, userQuery, botServices) {
  observability.logEvent(traceId, 'ImageVision', 'ANALYSIS_START', {
    hasQuery: !!userQuery,
    dataType: typeof imageData
  });

  // Coba gunakan LLM multimodal jika tersedia
  if (botServices.callVisionLLM && typeof botServices.callVisionLLM === 'function') {
    try {
      const visionResult = await botServices.callVisionLLM(imageData, userQuery || 'Jelaskan isi gambar ini secara detail.');
      
      observability.logEvent(traceId, 'ImageVision', 'LLM_VISION_SUCCESS');
      return {
        success: true,
        description: visionResult,
        confidence: 0.85,
        source: 'LLM_VISION',
        limitations: null
      };
    } catch (err) {
      observability.logEvent(traceId, 'ImageVision', 'LLM_VISION_FAILED', { error: err.message });
      // Jatuh ke fallback
    }
  }

  // Fallback: Deskripsi berbasis metadata + OCR jika suatu hari tersedia
  const fallback = generateFallbackDescription(traceId, imageData);
  if (Buffer.isBuffer(imageData) && userQuery && /teks|tulisan|ocr|baca/i.test(userQuery)) {
    const ocr = await performOCR(traceId, imageData);
    if (ocr.success && ocr.text) {
      fallback.ocrText = ocr.text;
      fallback.description += `\n\nTeks terdeteksi: ${ocr.text.slice(0, 1000)}`;
      fallback.confidence = Math.max(fallback.confidence, 0.55);
      fallback.source = 'OCR_FALLBACK';
    } else {
      fallback.limitations = `${fallback.limitations || ''} OCR belum tersedia, jadi teks kecil di gambar mungkin tidak terbaca.`.trim();
    }
  }
  return fallback;
}

/**
 * Fallback ketika LLM Vision tidak tersedia
 */
function generateFallbackDescription(traceId, imageData) {
  observability.logEvent(traceId, 'ImageVision', 'USING_FALLBACK_DESCRIPTION');

  const sizeKB = Buffer.isBuffer(imageData) ? (imageData.length / 1024).toFixed(1) : 'unknown';

  return {
    success: true,
    description: `Gambar diterima (${sizeKB} KB). Saat ini sistem belum terhubung ke API Vision untuk analisis visual mendalam. Silakan jelaskan apa yang Anda ingin ketahui dari gambar ini, dan saya akan membantu berdasarkan deskripsi Anda.`,
    confidence: 0.3,
    source: 'FALLBACK_METADATA',
    limitations: 'API Vision belum dikonfigurasi. Analisis berbasis metadata saja.'
  };
}

/**
 * Mencoba melakukan OCR pada gambar (Lazy Load)
 */
async function performOCR(traceId, imageBuffer) {
  observability.logEvent(traceId, 'ImageVision', 'OCR_ATTEMPT');

  // Placeholder untuk integrasi Tesseract.js atau API OCR
  // Di Render free tier, Tesseract.js sangat berat (>100MB RAM)
  // Jadi kita menyarankan penggunaan API eksternal jika dibutuhkan
  return {
    success: false,
    text: '',
    reason: 'OCR belum dikonfigurasi. Untuk mengaktifkan, integrasikan API OCR eksternal yang ringan.'
  };
}

/**
 * Membangun konteks visual untuk digabungkan dengan konteks teks
 */
function buildVisualContext(analysisResult, fileName) {
  const limitations = analysisResult.limitations || (analysisResult.confidence < 0.5
    ? 'Analisis visual confidence rendah; jangan jadikan satu-satunya dasar keputusan.'
    : null);
  return {
    contentType: 'image',
    fileName: fileName || 'image',
    primaryContent: analysisResult.description || '',
    chunks: [analysisResult.description || ''].filter(Boolean),
    keyPoints: [
      analysisResult.description ? `Deskripsi visual: ${analysisResult.description.slice(0, 220)}` : null,
      analysisResult.ocrText ? `OCR: ${analysisResult.ocrText.slice(0, 220)}` : null
    ].filter(Boolean),
    sourceCitations: [{
      id: 'image:1',
      label: `${fileName || 'image'}#visual-analysis`,
      chunkIndex: 0,
      preview: String(analysisResult.description || '').slice(0, 220)
    }],
    sourceAttribution: [`${fileName || 'image'}#visual-analysis`],
    semanticTags: ['image', 'visual'],
    confidence: analysisResult.confidence || 0.3,
    evidenceScore: analysisResult.confidence || 0.3,
    source: analysisResult.source || 'UNKNOWN',
    limitations,
    warnings: limitations ? [limitations] : [],
    extractedAt: Date.now()
  };
}

module.exports = {
  analyzeImage,
  generateFallbackDescription,
  performOCR,
  buildVisualContext
};
