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
    this.healthState = new Map();
    this.errorPatterns = new Map();
    this.collaborationWorkflows = [];
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

  setHealthState(component, status, metadata = {}) {
    this.healthState.set(component, {
      component,
      status,
      metadata,
      updatedAt: new Date().toISOString()
    });
  }

  recordErrorPattern(scope, error) {
    const key = `${scope}:${String(error?.message || error || 'UNKNOWN').slice(0, 120)}`;
    const prev = this.errorPatterns.get(key) || {
      scope,
      message: String(error?.message || error || 'UNKNOWN').slice(0, 300),
      count: 0,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: null
    };

    prev.count += 1;
    prev.lastSeenAt = new Date().toISOString();
    this.errorPatterns.set(key, prev);

    if (this.errorPatterns.size > 80) {
      const oldestKey = this.errorPatterns.keys().next().value;
      this.errorPatterns.delete(oldestKey);
    }
  }

  recordCollaborationWorkflow(traceId, workflowReport = {}) {
    const compact = {
      traceId,
      mode: workflowReport.mode || 'Standard',
      agents: workflowReport.agents || [],
      durationMs: workflowReport.durationMs || 0,
      consensusConfidence: workflowReport.consensusConfidence || 0,
      verificationConfidence: workflowReport.verificationConfidence || 0,
      completedAt: new Date().toISOString()
    };

    this.collaborationWorkflows.push(compact);
    if (this.collaborationWorkflows.length > 60) this.collaborationWorkflows.shift();

    this.logEvent(traceId, 'ObservabilityAgent', 'COLLABORATION_WORKFLOW_RECORDED', {
      mode: compact.mode,
      agentCount: compact.agents.length,
      consensusConfidence: compact.consensusConfidence
    });
  }

  getCollaborationAnalytics() {
    const recent = this.collaborationWorkflows.slice(-20);
    const avgConsensus = recent.length
      ? recent.reduce((sum, item) => sum + Number(item.consensusConfidence || 0), 0) / recent.length
      : 0;
    const avgLatency = recent.length
      ? recent.reduce((sum, item) => sum + Number(item.durationMs || 0), 0) / recent.length
      : 0;
    const agentActivity = {};

    for (const workflow of recent) {
      for (const agentName of workflow.agents || []) {
        agentActivity[agentName] = (agentActivity[agentName] || 0) + 1;
      }
    }

    return {
      recentWorkflowCount: recent.length,
      averageConsensusConfidence: Number(avgConsensus.toFixed(3)),
      averageWorkflowLatencyMs: Math.round(avgLatency),
      agentActivity,
      recentModes: recent.map((item) => item.mode).slice(-8)
    };
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
  diagnoseHealth(runtime = {}) {
    const issues = [];
    const telemetry = this.getSystemTelemetry();
    const queue = runtime.queue || {};

    // 1. Cek batas RAM Render ( Render free tier membatasi RAM 512 MB )
    if (telemetry.memoryUsageMB.rss > 350) {
      issues.push('HIGH_RAM_USAGE: RAM RSS melebihi 350MB, memicu risiko Render OOM.');
    }

    if (queue.maxQueueSize && queue.queuedCount >= Math.ceil(queue.maxQueueSize * 0.8)) {
      issues.push(`QUEUE_PRESSURE: Antrean ${queue.queuedCount}/${queue.maxQueueSize}, risiko respons melambat.`);
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
      telemetry,
      queue,
      healthState: Array.from(this.healthState.values()),
      collaboration: this.getCollaborationAnalytics(),
      recentErrorPatterns: Array.from(this.errorPatterns.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
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
