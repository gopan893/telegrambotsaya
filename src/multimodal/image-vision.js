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

  // Fallback: Deskripsi berbasis metadata
  return generateFallbackDescription(traceId, imageData);
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
  return {
    contentType: 'image',
    fileName: fileName || 'image',
    primaryContent: analysisResult.description || '',
    confidence: analysisResult.confidence || 0.3,
    source: analysisResult.source || 'UNKNOWN',
    limitations: analysisResult.limitations || null,
    extractedAt: Date.now()
  };
}

module.exports = {
  analyzeImage,
  generateFallbackDescription,
  performOCR,
  buildVisualContext
};
