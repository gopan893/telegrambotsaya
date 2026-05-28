'use strict';

const observability = require('./observability');

/**
 * Tool Router Agent
 * Melakukan pemilihan tool berbasis konteks (Context-aware Tool Selection)
 * dan mencatat Audit Trail penggunaan api eksternal secara lengkap.
 */
class ToolRouterAgent {
  constructor() {
    this.auditTrail = [];
  }

  /**
   * Memeriksa ketersediaan tool berdasarkan intent semantik
   * @param {string} traceId
   * @param {string} intent
   * @param {object} params
   * @returns {boolean} true jika intent valid untuk diproses sebagai tool
   */
  canRoute(traceId, intent, params) {
    if (!intent || intent === 'NONE') return false;

    const knownTools = [
      'TAMBAH_EVENT',
      'TAMBAH_TUGAS',
      'TAMBAH_PENGINGAT',
      'TAMBAH_MOOD',
      'CUACA',
      'SEARCH',
      'HITUNG',
      'JAM',
      'TANGGAL',
      'GAMBAR',
      'LOKASI'
    ];

    const exists = knownTools.includes(intent.toUpperCase());

    observability.logEvent(traceId, 'ToolRouterAgent', 'TOOL_ROUTABILITY_CHECK', {
      intent,
      isRoutable: exists,
      paramKeys: Object.keys(params || {})
    });

    return exists;
  }

  /**
   * Mencatat jejak audit eksekusi tool secara aman
   * @param {string} traceId
   * @param {string} intent
   * @param {object} params
   * @param {number} startTime
   * @param {boolean} success
   * @param {string|null} error
   */
  logAuditTrail(traceId, intent, params, startTime, success, error = null) {
    const duration = Date.now() - startTime;
    const auditRecord = {
      timestamp: new Date().toISOString(),
      traceId,
      intent,
      params,
      durationMs: duration,
      success,
      error: error || undefined
    };

    this.auditTrail.push(auditRecord);
    
    // Batasi kapasitas audit trail untuk RAM Render (RAM-optimized)
    if (this.auditTrail.length > 100) {
      this.auditTrail.shift();
    }

    observability.logEvent(traceId, 'ToolRouterAgent', 'TOOL_AUDIT_TRAIL_LOGGED', {
      intent,
      durationMs: duration,
      success,
      error
    });

    // Update status kesehatan API di Observability registry
    if (!success) {
      observability.updateCircuitBreaker(intent, 'FAIL', error);
    } else {
      observability.updateCircuitBreaker(intent, 'SUCCESS');
    }
  }

  /**
   * Mengembalikan log audit trail tool
   */
  getAuditTrail() {
    return this.auditTrail;
  }
}

const globalToolRouter = new ToolRouterAgent();

module.exports = globalToolRouter;
