'use strict';

/**
 * Observability & Telemetry Agent
 * Mengelola structured logging, event tracing, telemetry collection,
 * health state registry, dan auto-diagnostics.
 */
class ObservabilityAgent {
  constructor() {
    this.traces = new Map(); // traceId -> array of events
    this.circuitBreakers = new Map(); // serviceName -> { status: 'CLOSED'|'OPEN'|'HALF-OPEN', failures: 0, lastFailureTime: 0 }
    this.diagnosticsHistory = [];
    this.startTime = Date.now();
  }

  /**
   * Membuat traceId unik untuk setiap request baru
   */
  createTraceId() {
    return `tr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Mencatat event secara terstruktur
   */
  logEvent(traceId, agentName, eventName, metadata = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      agentName,
      eventName,
      ...metadata
    };

    if (traceId) {
      if (!this.traces.has(traceId)) {
        this.traces.set(traceId, []);
      }
      this.traces.get(traceId).push(event);
      if (this.traces.size > 120) this.purgeOldTraces();
    }

    // Structured JSON logging ke standard stdout (dioptimalkan untuk Render/Grafana/Papertrail)
    console.log(JSON.stringify({
      traceId,
      ...event
    }));
  }

  /**
   * Memperbarui status circuit breaker untuk layanan eksternal
   */
  updateCircuitBreaker(serviceName, state, errorMsg = null) {
    let cb = this.circuitBreakers.get(serviceName);
    if (!cb) {
      cb = { status: 'CLOSED', failures: 0, lastFailureTime: 0 };
    }

    if (state === 'FAIL') {
      cb.failures += 1;
      cb.lastFailureTime = Date.now();
      if (cb.failures >= 3) {
        cb.status = 'OPEN';
      }
      this.logEvent(null, 'ObservabilityAgent', 'CIRCUIT_BREAKER_FAIL', {
        serviceName,
        failures: cb.failures,
        status: cb.status,
        error: errorMsg
      });
    } else if (state === 'SUCCESS') {
      cb.failures = 0;
      cb.status = 'CLOSED';
      this.logEvent(null, 'ObservabilityAgent', 'CIRCUIT_BREAKER_OK', {
        serviceName,
        status: cb.status
      });
    }
    
    this.circuitBreakers.set(serviceName, cb);
  }

  /**
   * Memeriksa apakah suatu layanan eksternal sedang diblokir oleh Circuit Breaker
   */
  isServiceAvailable(serviceName) {
    const cb = this.circuitBreakers.get(serviceName);
    if (!cb) return true;
    
    if (cb.status === 'OPEN') {
      // Cooldown 30 detik untuk mencoba kembali (HALF-OPEN)
      if (Date.now() - cb.lastFailureTime > 30000) {
        cb.status = 'HALF-OPEN';
        this.circuitBreakers.set(serviceName, cb);
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Mengumpulkan telemetri sistem secara instan
   */
  getSystemTelemetry() {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsageMB: {
        rss: Math.floor(mem.rss / 1024 / 1024),
        heapTotal: Math.floor(mem.heapTotal / 1024 / 1024),
        heapUsed: Math.floor(mem.heapUsed / 1024 / 1024),
        external: Math.floor(mem.external / 1024 / 1024)
      },
      activeTraces: this.traces.size
    };
  }

  /**
   * Sistem Auto-Diagnostics Internal
   * Memindai seluruh status sistem dan memberikan kesimpulan kesehatan
   */
  diagnoseHealth() {
    const issues = [];
    const telemetry = this.getSystemTelemetry();

    // 1. Cek batas RAM Render ( Render free tier membatasi RAM 512 MB )
    if (telemetry.memoryUsageMB.rss > 350) {
      issues.push('HIGH_RAM_USAGE: RAM RSS melebihi 350MB, memicu risiko Render OOM.');
    }

    // 2. Cek status API eksternal
    for (const [service, cb] of this.circuitBreakers.entries()) {
      if (cb.status === 'OPEN') {
        issues.push(`CIRCUIT_BREAKER_OPEN: Layanan "${service}" sedang ditutup sementara karena kegagalan berulang.`);
      }
    }

    const healthStatus = issues.length === 0 ? 'HEALTHY' : 'WARNING';
    const report = {
      timestamp: new Date().toISOString(),
      status: healthStatus,
      issues,
      telemetry
    };

    this.diagnosticsHistory.push(report);
    if (this.diagnosticsHistory.length > 50) this.diagnosticsHistory.shift();

    return report;
  }

  /**
   * Mengambil seluruh alur trace per request
   */
  getTraceReport(traceId) {
    return this.traces.get(traceId) || [];
  }

  /**
   * Bersihkan trace yang lama agar memori tetap bersih (RAM-optimized)
   */
  purgeOldTraces() {
    if (this.traces.size > 100) {
      // Hapus setengah trace terlama
      const keys = Array.from(this.traces.keys());
      const toDelete = keys.slice(0, 50);
      for (const k of toDelete) {
        this.traces.delete(k);
      }
    }
  }
}

// Export singleton instance
const globalObservability = new ObservabilityAgent();

module.exports = globalObservability;
