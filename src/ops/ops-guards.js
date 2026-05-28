'use strict';

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizeText(text, maxLen = 500) {
  return String(text || '')
    .replace(/(sk-[a-zA-Z0-9_-]+|xai-[a-zA-Z0-9_-]+|AIza[^\s]+)/g, '[redacted]')
    .replace(/(token|api[_-]?key|secret|password)\s*[:=]\s*[^\s]+/gi, '$1=[redacted]')
    .slice(0, maxLen);
}

function sanitizeMeta(meta = {}) {
  const out = {};
  for (const [key, value] of Object.entries(meta || {})) {
    const lowerKey = String(key).toLowerCase();
    if (/(token|secret|password|api.?key|authorization|cookie)/.test(lowerKey)) {
      out[key] = '[redacted]';
    } else if (typeof value === 'string') {
      out[key] = sanitizeText(value, 220);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 8).map(item => typeof item === 'string' ? sanitizeText(item, 120) : item);
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeText(JSON.stringify(value), 260);
    }
  }
  return out;
}

function shouldSample(currentCount, rate = 1) {
  const safeRate = clamp(rate, 0.01, 1);
  if (safeRate >= 1) return true;
  if (currentCount < 50) return true;
  return Math.random() <= safeRate;
}

function getRecent(list, windowMs) {
  const now = Date.now();
  return (Array.isArray(list) ? list : []).filter(item => {
    const ts = Date.parse(item.timestamp || item.createdAt || item.completedAt || 0);
    return Number.isFinite(ts) && now - ts <= windowMs;
  });
}

function suppressFalsePositive(state, key, windowMs = 5 * 60 * 1000, threshold = 2) {
  const now = Date.now();
  if (!state._guards) state._guards = {};
  const entry = state._guards[key] || { count: 0, firstSeenAt: now, lastSeenAt: now };
  if (now - entry.firstSeenAt > windowMs) {
    entry.count = 0;
    entry.firstSeenAt = now;
  }
  entry.count += 1;
  entry.lastSeenAt = now;
  state._guards[key] = entry;
  return entry.count < threshold;
}

function detectTokenSpike(tokenSamples, multiplier = 2.5) {
  const samples = (Array.isArray(tokenSamples) ? tokenSamples : [])
    .map(item => Number(item.totalTokens || 0))
    .filter(n => n > 0)
    .slice(-30);
  if (samples.length < 8) return { spike: false, ratio: 1 };
  const last = samples[samples.length - 1];
  const avg = samples.slice(0, -1).reduce((sum, n) => sum + n, 0) / (samples.length - 1);
  const ratio = avg > 0 ? last / avg : 1;
  return { spike: ratio >= multiplier, ratio: Number(ratio.toFixed(2)), last, average: Math.round(avg) };
}

function isSensitiveAction(action) {
  return /(delete|reset|rollback|push|deploy|payment|credential|token|secret|admin|calendar|email|file-write|exec)/i
    .test(String(action || ''));
}

function guardAutonomousAction(action = {}) {
  const risk = Number(action.risk || 0);
  const confidence = Number(action.confidence || 0);
  const sensitive = isSensitiveAction(action.type || action.name || action.description);
  if (sensitive && !action.confirmedByAdmin) {
    return { allowed: false, reason: 'Aksi sensitif perlu konfirmasi admin.' };
  }
  if (risk >= 0.7 && confidence < 0.75) {
    return { allowed: false, reason: 'Risiko tinggi dan confidence belum cukup.' };
  }
  return { allowed: true, reason: 'Aksi tergolong aman.' };
}

function preventOverOptimization(recommendations = []) {
  return (Array.isArray(recommendations) ? recommendations : [])
    .filter(item => Number(item.confidence || 0.5) >= 0.55)
    .slice(0, 6);
}

function incidentEscalationGuard(state, severity, evidenceCount = 0) {
  if (severity !== 'critical') return { allowed: true, severity };
  const recentCritical = getRecent(state.incidents || [], 10 * 60 * 1000)
    .filter(item => item.severity === 'critical').length;
  if (evidenceCount < 2 && recentCritical < 1) {
    return {
      allowed: false,
      severity: 'incident',
      reason: 'Critical escalation ditahan sampai ada evidence berulang.'
    };
  }
  return { allowed: true, severity };
}

function unstableTuningGuard(state, setting, minIntervalMs = 30 * 60 * 1000) {
  const recent = (state.tuningHistory || []).slice().reverse().find(item => item.setting === setting);
  if (!recent) return { allowed: true };
  const ts = Date.parse(recent.timestamp || 0);
  if (Number.isFinite(ts) && Date.now() - ts < minIntervalMs) {
    return { allowed: false, reason: 'Tuning terlalu sering untuk setting yang sama.' };
  }
  return { allowed: true };
}

function unsafeOptimizationBlocker(recommendation = {}) {
  const text = `${recommendation.action || ''} ${recommendation.setting || ''} ${recommendation.reason || ''}`;
  if (/disable.*safety|skip.*safety|remove.*guard|bypass/i.test(text)) {
    return { allowed: false, reason: 'Optimasi tidak boleh mengurangi safety guard.' };
  }
  return { allowed: true };
}

function runawayCostPrevention(state, action = '') {
  const recentBenchmarks = getRecent(state.benchmarkRuns || [], 15 * 60 * 1000).length;
  const recentAiCalls = getRecent(state.telemetry?.events || [], 15 * 60 * 1000)
    .filter(item => item.type === 'aiCall').length;
  if (/benchmark|evaluation/i.test(action) && recentBenchmarks >= 3) {
    return { allowed: false, reason: 'Benchmark terlalu sering dalam 15 menit terakhir.' };
  }
  if (/ai|reasoning/i.test(action) && recentAiCalls >= 40) {
    return { allowed: false, reason: 'AI ops call terlalu tinggi dalam 15 menit terakhir.' };
  }
  return { allowed: true };
}

function regressionRollbackGuard(regression = {}) {
  if (!regression.regressionDetected && !regression.detected) {
    return { allowed: false, reason: 'Rollback tidak disarankan tanpa bukti regresi.' };
  }
  if (!['high', 'critical'].includes(regression.severity)) {
    return { allowed: false, reason: 'Regresi belum cukup berat untuk rollback; gunakan tuning dulu.' };
  }
  return { allowed: true };
}

function loopPrevention(state, key, windowMs = 5 * 60 * 1000) {
  if (!state._loops) state._loops = {};
  const now = Date.now();
  const entry = state._loops[key] || { count: 0, startedAt: now };
  if (now - entry.startedAt > windowMs) {
    entry.count = 0;
    entry.startedAt = now;
  }
  entry.count += 1;
  state._loops[key] = entry;
  return {
    allowed: entry.count <= 3,
    count: entry.count,
    reason: entry.count > 3 ? 'Loop diagnostics/recovery dicegah.' : 'ok'
  };
}

function recoverCorruptedTelemetry(state) {
  if (!state.telemetry || typeof state.telemetry !== 'object') {
    state.telemetry = {};
  }
  if (!state.telemetry.counters || typeof state.telemetry.counters !== 'object') {
    state.telemetry.counters = {};
  }
  for (const key of ['events', 'latencySamples', 'tokenSamples', 'recentErrors']) {
    if (!Array.isArray(state.telemetry[key])) state.telemetry[key] = [];
  }
  return state.telemetry;
}

function brittleImprovementPrevention(sampleCount, confidence = 0.5) {
  if (Number(sampleCount || 0) < 3 && Number(confidence || 0) < 0.85) {
    return { allowed: false, reason: 'Sample terlalu sedikit untuk optimasi permanen.' };
  }
  return { allowed: true };
}

function safeError(err, scope = 'unknown') {
  return {
    scope,
    message: sanitizeText(err?.message || err || 'Unknown error', 300),
    name: sanitizeText(err?.name || 'Error', 80),
    timestamp: nowIso()
  };
}

module.exports = {
  nowIso,
  clamp,
  sanitizeText,
  sanitizeMeta,
  shouldSample,
  getRecent,
  suppressFalsePositive,
  detectTokenSpike,
  isSensitiveAction,
  guardAutonomousAction,
  preventOverOptimization,
  incidentEscalationGuard,
  unstableTuningGuard,
  unsafeOptimizationBlocker,
  runawayCostPrevention,
  regressionRollbackGuard,
  loopPrevention,
  recoverCorruptedTelemetry,
  brittleImprovementPrevention,
  safeError
};
