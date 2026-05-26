'use strict';

const observability = require('./observability');

/**
 * Verifier Agent (Phase 5)
 * Memvalidasi fakta dan logika, melindungi dari halusinasi, mendeteksi penalaran berputar (circular reasoning),
 * mencegah runaway reasoning (self-loop detection), dan mengevaluasi invalid self-correction.
 */
class VerifierAgent {
  constructor() {}

  /**
   * Mendeteksi adanya penalaran berputar (circular reasoning) atau self-loop (pengulangan identik berulang)
   */
  detectCircularReasoning(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    const patterns = [
      'karena itu benar karena',
      'karena dia baik karena dia baik',
      'sebab hal tersebut disebabkan',
      'is true because it is true',
      'karena hal tersebut benar'
    ];

    if (patterns.some(p => lower.includes(p))) return true;

    // Self-loop detection: mendeteksi kalimat yang diulang-ulang sama persis dalam satu respons
    const sentences = text.split(/[.?!]/).map(s => s.trim()).filter(s => s.length > 20);
    const uniqueSentences = new Set(sentences);
    if (sentences.length > 3 && uniqueSentences.size < sentences.length / 2) {
      // Jika lebih dari separuh kalimat adalah duplikat = Self-Loop / Runaway Reasoning
      return true;
    }

    return false;
  }

  /**
   * Melakukan pendeteksian invalid self-correction (misal LLM tiba-tiba mengkoreksi hal yang sudah benar menjadi salah)
   */
  detectInvalidSelfCorrection(text) {
    const lower = (text || '').toLowerCase();
    // Jika AI bilang "Oh maaf saya salah" padahal tidak ada prompt koreksi dari user (runaway thought)
    if (lower.includes('oh maaf saya salah, sebelumnya') || lower.includes('tunggu, sepertinya saya keliru')) {
      return true; // Perlu diwaspadai sebagai halusinasi reflektif
    }
    return false;
  }

  /**
   * Menilai tingkat keyakinan (Confidence Score) pasca evaluasi
   */
  assessConfidence(intent, answer, qualityScore) {
    let confidence = qualityScore; 

    const lowerAnswer = String(answer || '').toLowerCase();

    // 1. Indikasi ketidakpastian eksplisit
    const uncertaintyKeywords = ['mungkin', 'sepertinya', 'saya rasa', 'kemungkinan', 'belum pasti', 'tidak yakin', 'ragu-ragu'];
    let uncertaintyCount = 0;
    for (const kw of uncertaintyKeywords) {
      if (lowerAnswer.includes(kw)) uncertaintyCount++;
    }
    if (uncertaintyCount > 0) confidence -= Math.min(0.3, uncertaintyCount * 0.1);

    // 2. Circular Reasoning Penalty
    if (this.detectCircularReasoning(lowerAnswer)) confidence -= 0.5;

    // 3. Invalid Self Correction Penalty
    if (this.detectInvalidSelfCorrection(lowerAnswer)) confidence -= 0.3;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Memvalidasi hasil keluaran
   * @returns {object} { ok, finalAnswer, confidence, annotation, failedReason }
   */
  verify(traceId, intent, answerText, qualityScore) {
    observability.logEvent(traceId, 'VerifierAgent', 'VERIFICATION_START');

    const confidence = this.assessConfidence(intent, answerText, qualityScore);
    let finalAnswer = answerText;
    let annotation = null;
    let failedReason = null;

    if (confidence < 0.4) { // Ditingkatkan ambangnya dari 0.3 ke 0.4
      annotation = 'LOW_CONFIDENCE_WARNING';
      finalAnswer = `${finalAnswer}\n\n⚠️ *(Tingkat keyakinan argumen ini rendah. Sistem AI menyarankan verifikasi mandiri sebelum mengambil keputusan.)*`;
      failedReason = 'CONFIDENCE_TOO_LOW';
      
      observability.logEvent(traceId, 'VerifierAgent', 'LOW_CONFIDENCE_WARNING_ANNOTATED', { confidence });
    } else if (this.detectCircularReasoning(answerText)) {
      annotation = 'RUNAWAY_REASONING_PREVENTED';
      finalAnswer = 'Maaf, saya mengalami kendala penalaran berputar (circular reasoning) saat memproses hal ini. Bisakah Anda memberikan pertanyaan yang lebih spesifik?';
      failedReason = 'CIRCULAR_REASONING';
      
      observability.logEvent(traceId, 'VerifierAgent', 'RUNAWAY_REASONING_BLOCKED', { confidence });
    } else {
      observability.logEvent(traceId, 'VerifierAgent', 'VERIFICATION_SUCCESS', { confidence });
    }

    return {
      ok: !failedReason,
      finalAnswer,
      confidence,
      annotation,
      failedReason
    };
  }
}

module.exports = new VerifierAgent();
