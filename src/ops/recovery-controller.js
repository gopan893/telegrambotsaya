'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const diagnosticsEngine = require('./diagnostics-engine');

function createRecoveryPlan(diagnosis) {
  const actions = [];
  const type = diagnosis?.diagnosis || 'healthy';

  if (type === 'infra_issue') {
    actions.push('clear_volatile_ops_cache', 'reduce_ai_orchestration', 'suggest_manual_restart');
  } else if (type === 'model_issue') {
    actions.push('mark_provider_degraded', 'fallback_to_simple_mode', 'reset_circuit_breaker_after_cooldown');
  } else if (type === 'workflow_issue') {
    actions.push('pause_non_critical_evaluation', 'fallback_to_simple_mode', 'increase_queue_cooldown_recommendation');
  } else if (type === 'cost_issue') {
    actions.push('enable_summary_context', 'reduce_max_tokens_recommendation');
  } else if (type === 'tool_issue') {
    actions.push('disable_non_critical_ops_temporarily', 'fallback_to_simple_mode');
  } else {
    actions.push('keep_monitoring');
  }

  return {
    severity: diagnosis?.severity || 'info',
    actions,
    requiresAdminConfirmation: actions.some(guards.isSensitiveAction),
    notes: 'Recovery otomatis hanya menjalankan aksi non-destruktif. Aksi sensitif tetap butuh admin.'
  };
}

function executeRecoveryAction(action, services = {}, options = {}) {
  const state = store.getOpsState(services);
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
  if (action === 'clear_volatile_ops_cache') {
    state.telemetry.events = [];
    state.telemetry.latencySamples = state.telemetry.latencySamples.slice(-40);
    state.profiler.operations = state.profiler.operations.slice(-40);
    result.effect = 'ops_volatile_cache_pruned';
  } else if (action === 'pause_non_critical_evaluation') {
    state.scheduler.enabled = false;
    result.effect = 'evaluation_scheduler_paused';
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
  executeRecoveryAction,
  getRecoveryRecommendation
};
