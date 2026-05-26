'use strict';

const observability = require('./observability');

/**
 * Recovery & Fault Tolerance Agent
 * Menyediakan penanganan kegagalan sistem, pemulihan sesi obrolan (Conversation State Recovery),
 * pembatasan circuit breaker, serta mitigasi kegagalan anggun (*graceful degradation*).
 */
class RecoveryAgent {
  constructor() {}

  /**
   * Mengambil tindakan pemulihan jika terjadi error tak terduga dalam alur pemrosesan
   * @param {string} traceId
   * @param {string} userId
   * @param {Error} error
   * @param {object} botServices
   */
  async handlePipelineFailure(traceId, userId, error, botServices) {
    observability.logEvent(traceId, 'RecoveryAgent', 'PIPELINE_FAILURE_TRIGGERED', {
      error: error.message
    });
    observability.recordErrorPattern('pipeline', error);

    const { ensureUser, persist } = botServices;

    try {
      // 1. Coba pulihkan/reset sessionState jika disinyalir corrupt
      const u = ensureUser(userId);
      if (u.sessionState && (typeof u.sessionState !== 'object' || !u.sessionState.activeTask)) {
        u.sessionState = {
          activeTask: null,
          steps: [],
          currentStepIndex: -1,
          contextData: {},
          lastActiveAt: 0
        };
        await persist();
        observability.logEvent(traceId, 'RecoveryAgent', 'SESSION_STATE_CORRUPTION_RECOVERED');
      }
    } catch (recoverErr) {
      observability.logEvent(traceId, 'RecoveryAgent', 'SESSION_STATE_RECOVERY_FAILED', {
        error: recoverErr.message
      });
    }

    // 2. Berikan tanggapan fallback produksi yang aman (Graceful Degradation)
    return `⚠️ **Sistem Mengalami Kendala Teknis**: Sistem cerdas sedang memulihkan diri dari gangguan sementara. 

Tetapi jangan khawatir, Anda tetap dapat menggunakan perintah utama seperti:
- /help - Melihat panduan bantuan
- /stats - Cek status Anda
- /reset - Mengatur ulang sesi percakapan Anda`;
  }

  /**
   * Melakukan perlindungan circuit breaker dengan memberikan jawaban degradasi jika API mati
   * @param {string} traceId
   * @param {string} serviceName Nama layanan (misal: 'CUACA', 'SEARCH')
   * @returns {string} Jawaban fallback ramah pengguna
   */
  getDegradedFallback(traceId, serviceName) {
    observability.logEvent(traceId, 'RecoveryAgent', 'GRACEFUL_DEGRADATION_APPLIED', {
      serviceName
    });

    switch (serviceName) {
      case 'CUACA':
        return 'Maaf, server cuaca sedang tidak dapat dihubungi saat ini. Coba periksa perkiraan cuaca di aplikasi ponsel Anda sementara waktu.';
      case 'SEARCH':
        return 'Maaf, mesin pencarian Tavily sedang mengalami gangguan atau kuota API habis. Saya hanya dapat menjawab berdasarkan pengetahuan internal saya saat ini.';
      case 'GAMBAR':
        return 'Maaf, generator gambar AI sedang mengalami antrean yang sangat padat. Silakan coba kembali beberapa saat lagi.';
      default:
        return 'Maaf, layanan pintar ini sedang offline untuk pemeliharaan singkat. Silakan ulangi perintah Anda sebentar lagi.';
    }
  }
}

const globalRecovery = new RecoveryAgent();

module.exports = globalRecovery;
