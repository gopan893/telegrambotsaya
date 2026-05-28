'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const diagnosticsEngine = require('./diagnostics-engine');

const SAFE_RECOVERY_ACTIONS = new Set([
  'clear_volatile_ops_cache',
  'prune_telemetry',
  'mark_provider_degraded',
  'reduce_non_critical_benchmark_frequency',
  'switch_to_lightweight_mode',
  'reset_local_ops_counters',
  'pause_non_critical_evaluation',
  'keep_monitoring'
]);

function createRecoveryPlan(diagnosis) {
  const actions = [];
  const type = diagnosis?.diagnosis || 'healthy';

  if (type === 'infra_issue') {
    actions.push('clear_volatile_ops_cache', 'prune_telemetry', 'reduce_non_critical_benchmark_frequency', 'suggest_manual_restart');
  } else if (type === 'model_issue') {
    actions.push('mark_provider_degraded', 'switch_to_lightweight_mode', 'reset_circuit_breaker_after_cooldown');
  } else if (type === 'workflow_issue') {
    actions.push('pause_non_critical_evaluation', 'switch_to_lightweight_mode', 'increase_queue_cooldown_recommendation');
  } else if (type === 'cost_issue') {
    actions.push('enable_summary_context', 'reduce_max_tokens_recommendation');
  } else if (type === 'tool_issue') {
    actions.push('disable_non_critical_ops_temporarily', 'switch_to_lightweight_mode');
  } else {
    actions.push('keep_monitoring');
  }

  const detailedActions = actions.map(action => describeRecoveryAction(action));
  return {
    severity: diagnosis?.severity || 'info',
    recommendedAction: detailedActions[0] || describeRecoveryAction('keep_monitoring'),
    actions: detailedActions,
    requiresAdminConfirmation: actions.some(guards.isSensitiveAction),
    notes: 'Recovery otomatis hanya menjalankan aksi non-destruktif. Aksi sensitif tetap butuh admin.'
  };
}

function describeRecoveryAction(action) {
  const risk = SAFE_RECOVERY_ACTIONS.has(action) ? 'low' : 'medium';
  const impact = {
    clear_volatile_ops_cache: 'Mengurangi data ops sementara tanpa menghapus memory user.',
    prune_telemetry: 'Memangkas telemetry lama agar RAM/storage tetap kecil.',
    mark_provider_degraded: 'Menandai provider bermasalah agar routing lebih hati-hati.',
    reduce_non_critical_benchmark_frequency: 'Mengurangi beban benchmark background.',
    switch_to_lightweight_mode: 'Mengutamakan pipeline ringan untuk menjaga stabilitas.',
    reset_local_ops_counters: 'Mengosongkan counter ops lokal tanpa menghapus user memory.',
    pause_non_critical_evaluation: 'Menghentikan evaluasi ringan sementara.',
    keep_monitoring: 'Tidak mengubah state, hanya melanjutkan monitoring.'
  }[action] || 'Recommendation only, tidak menjalankan aksi destruktif.';
  return {
    action,
    riskLevel: risk,
    expectedImpact: impact,
    rollbackOption: 'Ops state bisa dipantau ulang lewat /ops; aksi destruktif tidak dijalankan otomatis.',
    confidence: SAFE_RECOVERY_ACTIONS.has(action) ? 0.78 : 0.55,
    safeToExecute: SAFE_RECOVERY_ACTIONS.has(action)
  };
}

function executeRecoveryAction(action, services = {}, options = {}) {
  const state = store.getOpsState(services);
  if (!SAFE_RECOVERY_ACTIONS.has(action)) {
    return {
      ok: false,
      action,
      reason: 'Aksi recovery ini tidak termasuk safe action. Gunakan rollback/tuning manual.'
    };
  }
  const gate = guards.guardAutonomousAction({
    type: action,
    confidence: options.confidence || 0.8,
    risk: guards.isSensitiveAction(action) ? 0.8 : 0.25,
    confirmedByAdmin: Boolean(options.confirmedByAdmin)
  });
  if (!gate.allowed) {
    return { ok: false, action, reason: gate.reason };
  }

  let result = { ok: true, action, effect: 'recommendation_only' };
  if (action === 'clear_volatile_ops_cache' || action === 'prune_telemetry') {
    state.telemetry.events = [];
    state.telemetry.latencySamples = state.telemetry.latencySamples.slice(-40);
    state.telemetry.tokenSamples = state.telemetry.tokenSamples.slice(-40);
    state.profiler.operations = state.profiler.operations.slice(-40);
    result.effect = 'ops_volatile_cache_pruned';
  } else if (action === 'pause_non_critical_evaluation') {
    state.scheduler.enabled = false;
    result.effect = 'evaluation_scheduler_paused';
  } else if (action === 'reduce_non_critical_benchmark_frequency') {
    state.scheduler.intervalMs = Math.max(Number(state.scheduler.intervalMs || 0), 12 * 60 * 60 * 1000);
    result.effect = 'benchmark_frequency_reduced';
  } else if (action === 'switch_to_lightweight_mode') {
    state.config.telemetrySamplingRate = Math.min(Number(state.config.telemetrySamplingRate || 1), 0.5);
    result.effect = 'lightweight_mode_marked';
  } else if (action === 'reset_local_ops_counters') {
    state.telemetry.counters = {
      request: 0,
      command: 0,
      aiCall: 0,
      toolExecution: 0,
      error: 0,
      memoryAccess: 0,
      workflowExecution: 0
    };
    result.effect = 'ops_counters_reset';
  } else if (action === 'mark_provider_degraded') {
    const provider = options.provider || 'unknown';
    state.providerState[provider] = {
      status: 'degraded',
      reason: guards.sanitizeText(options.reason || 'manual recovery plan', 180),
      updatedAt: guards.nowIso()
    };
    result.effect = `provider_${provider}_marked_degraded`;
  }

  store.appendBounded(state.recoveryHistory, {
    timestamp: guards.nowIso(),
    action,
    result: result.effect
  }, 50);
  store.compactState(state);
  store.saveOpsState(services);
  return result;
}

function getRecoveryRecommendation(services = {}) {
  const diagnosis = diagnosticsEngine.diagnose(services);
  return {
    diagnosis,
    plan: createRecoveryPlan(diagnosis)
  };
}

module.exports = {
  createRecoveryPlan,
  describeRecoveryAction,
  executeRecoveryAction,
  getRecoveryRecommendation
};
