'use strict';

const observability = require('./observability');

/**
 * Introspection Agent (Phase 5)
 * Lapisan kognitif yang memantau internal state: mendeteksi kelemahan reasoning, kontradiksi logika,
 * serta mengelola uncertainty (keraguan) sebelum memberikan respons ke pengguna.
 */
class IntrospectionAgent {
  constructor() {}

  /**
   * Mengecek apakah alasan (reasoning) di dalam draf terlalu lemah
   */
  isReasoningWeak(draftAnswer) {
    if (!draftAnswer) return true;
    const lower = draftAnswer.toLowerCase();

    // Indikasi reasoning malas/lemah
    const weakPatterns = [
      'saya rasa begitu',
      'mungkin saja',
      'tergantung',
      'saya tidak yakin tapi',
      'tidak ada alasan khusus'
    ];

    let weakness = 0;
    for (const pat of weakPatterns) {
      if (lower.includes(pat)) weakness++;
    }

    // Jika jawaban sangat pendek tanpa penjelasan teknis
    if (draftAnswer.length < 30 && weakness > 0) {
      return true;
    }
    return weakness > 1;
  }

  /**
   * Mendeteksi kontradiksi di dalam jawaban
   */
  detectContradiction(draftAnswer) {
    if (!draftAnswer) return false;
    const lower = draftAnswer.toLowerCase();

    // Pola kontradiksi dasar
    if (lower.includes('benar') && lower.includes('salah') && lower.length < 100) return true;
    if (lower.includes('bisa') && lower.includes('tidak bisa') && Math.abs(lower.indexOf('bisa') - lower.indexOf('tidak bisa')) < 50) return true;
    
    return false;
  }

  /**
   * Mengelola tingkat keraguan (Uncertainty Management)
   * Jika sistem merasa ragu, ia harus meminta klarifikasi alih-alih berhalusinasi.
   * @returns {object} { needsClarification: boolean, clarificationPrompt: string }
   */
  manageUncertainty(traceId, confidenceScore, intent) {
    if (confidenceScore >= 0.6) {
      return { needsClarification: false, clarificationPrompt: null };
    }

    observability.logEvent(traceId, 'IntrospectionAgent', 'HIGH_UNCERTAINTY_DETECTED', { confidenceScore, intent });

    // AI harus bisa mengatakan "saya belum yakin"
    let prompt = 'Hmm, saya belum sepenuhnya yakin dengan maksud Anda atau informasi yang saya miliki.';
    
    if (intent === 'CODE_REVIEW') {
      prompt = 'Untuk analisis kode ini, saya tidak memiliki cukup konteks pasti. Bisa jelaskan bagian mana yang Anda ragukan?';
    } else if (intent === 'EXECUTE_SYSTEM_COMMAND') {
      prompt = 'Tindakan ini berisiko dan saya ragu dengan parameternya. Apakah Anda benar-benar yakin ingin menjalankan perintah ini?';
    } else {
      prompt = 'Bisakah Anda memberikan lebih banyak detail atau klarifikasi agar saya tidak salah memberikan informasi?';
    }

    return {
      needsClarification: true,
      clarificationPrompt: prompt
    };
  }

  /**
   * Introspeksi penuh atas draf yang dibuat oleh Planner/Executor
   */
  introspect(traceId, draftAnswer, confidenceScore, intent) {
    observability.logEvent(traceId, 'IntrospectionAgent', 'INTROSPECTION_START');

    const uncertainty = this.manageUncertainty(traceId, confidenceScore, intent);
    if (uncertainty.needsClarification) {
      return {
        passed: false,
        fallbackText: uncertainty.clarificationPrompt,
        reason: 'HIGH_UNCERTAINTY'
      };
    }

    if (this.detectContradiction(draftAnswer)) {
      observability.logEvent(traceId, 'IntrospectionAgent', 'CONTRADICTION_DETECTED');
      return {
        passed: false,
        fallbackText: 'Maaf, saya mendeteksi adanya kontradiksi dalam logika internal saya. Mari kita urai masalah ini perlahan-lahan dari awal.',
        reason: 'LOGICAL_CONTRADICTION'
      };
    }

    if (this.isReasoningWeak(draftAnswer)) {
      observability.logEvent(traceId, 'IntrospectionAgent', 'WEAK_REASONING_DETECTED');
      return {
        passed: false, // Menandakan butuh Deep Analysis Mode (jika diaktifkan)
        fallbackText: null, // Biarkan Evaluator menanganinya
        reason: 'WEAK_REASONING'
      };
    }

    observability.logEvent(traceId, 'IntrospectionAgent', 'INTROSPECTION_PASSED');
    return { passed: true, fallbackText: null, reason: 'OK' };
  }
}

module.exports = new IntrospectionAgent();
