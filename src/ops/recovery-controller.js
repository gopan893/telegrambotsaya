'use strict';

const store = require('./ops-store');
const healthMonitor = require('./health-monitor');
const diagnosticsEngine = require('./diagnostics-engine');
const guards = require('./ops-guards');

function getRecoveryRecommendation(services = {}, input = {}) {
  const health = input.health || healthMonitor.getHealth(services);
  const diagnosis = input.diagnosis || diagnosticsEngine.diagnose(services, { health });
  const actions = [];

  if (diagnosis.severity === 'critical') {
    if (diagnosis.diagnosis === 'model_issue') {
      actions.push({
        action: 'switch_to_fallback_provider',
        riskLevel: 'low',
        safeToExecute: true,
        expectedImpact: 'Memulihkan kemampuan AI dengan beralih ke provider cadangan (Groq/Mistral).',
        rollbackOption: 'Beralih kembali setelah primary provider kembali stabil.'
      });
    }
    if (diagnosis.diagnosis === 'infra_issue') {
      actions.push({
        action: 'prune_volatile_telemetry',
        riskLevel: 'low',
        safeToExecute: true,
        expectedImpact: 'Membersihkan telemetry lama di memory untuk meringankan RAM RSS.',
        rollbackOption: 'Tidak ada (pruning telemetry aman dilakukan kapan saja).'
      });
      actions.push({
        action: 'clear_ops_caches',
        riskLevel: 'low',
        safeToExecute: true,
        expectedImpact: 'Mereset cache transient ops untuk membebaskan heap memory.',
        rollbackOption: 'Cache akan terisi kembali secara bertahap.'
      });
    }
  }

  if (diagnosis.severity === 'degraded' || diagnosis.severity === 'warning') {
    actions.push({
      action: 'cooldown_circuit_breakers',
      riskLevel: 'low',
      safeToExecute: true,
      expectedImpact: 'Mereset status circuit breaker provider AI yang sempat cooldown.',
      rollbackOption: 'Akan terbuka kembali jika kegagalan berulang.'
    });
    actions.push({
      action: 'enable_lightweight_routing',
      riskLevel: 'low',
      safeToExecute: true,
      expectedImpact: 'Mengaktifkan mode adaptif sederhana untuk membatasi token/orchestration.',
      rollbackOption: 'Nonaktifkan mode adaptif setelah load menurun.'
    });
  }

  // Fallback safe action
  if (actions.length === 0) {
    actions.push({
      action: 'noop_maintain_baseline',
      riskLevel: 'low',
      safeToExecute: true,
      expectedImpact: 'Baseline stabil, tidak memerlukan tindakan mitigasi aktif.',
      rollbackOption: 'N/A'
    });
  }

  const worst = actions.find(item => item.safeToExecute) || actions[0];

  return {
    diagnosis,
    severity: diagnosis.severity,
    recommendedAction: worst,
    actions,
    plan: {
      recommendedAction: worst,
      actions
    },
    generatedAt: guards.nowIso()
  };
}

function executeRecoveryAction(action, services = {}, ctx = {}) {
  const allowedGuard = guards.guardAutonomousAction({
    type: 'recovery_action',
    name: action,
    risk: action.includes('clear') ? 0.3 : 0.1,
    confidence: ctx.confidence || 0.8,
    confirmedByAdmin: Boolean(ctx.confirmedByAdmin)
  });
  if (!allowedGuard.allowed) {
    return { ok: false, reason: allowedGuard.reason };
  }

  const loopGuard = guards.loopPrevention(store.getOpsState(services), `recovery:${action}`);
  if (!loopGuard.allowed) {
    return { ok: false, reason: loopGuard.reason };
  }

  const state = store.getOpsState(services);
  let effect = 'No-op.';
  let executed = false;

  if (action === 'prune_volatile_telemetry') {
    state.telemetry.events = [];
    state.telemetry.latencySamples = [];
    state.telemetry.tokenSamples = [];
    effect = 'Cleaned active telemetry lists in state.';
    executed = true;
  } else if (action === 'clear_ops_caches') {
    state.profiler.operations = [];
    effect = 'Cleared operations profile records cache.';
    executed = true;
  } else if (action === 'switch_to_fallback_provider') {
    state.providerState.activeFallback = true;
    effect = 'Forced fallback AI provider mode.';
    executed = true;
  } else if (action === 'cooldown_circuit_breakers') {
    if (services.aiCircuitBreaker?.reset) {
      services.aiCircuitBreaker.reset();
    }
    effect = 'Cooldown circuit breakers successfully called.';
    executed = true;
  } else if (action === 'enable_lightweight_routing') {
    state.adaptive.lightweightModeEnabled = true;
    effect = 'Enabled lightweight routing override.';
    executed = true;
  }

  if (executed) {
    state.recoveryHistory.push({
      action,
      timestamp: guards.nowIso(),
      effect,
      status: 'success'
    });
    store.saveOpsState(services);
  }

  return { ok: true, action, effect };
}

// Section I Required Functions:
function getRecoveryRecommendations(diagnostics = {}, services = {}) {
  return getRecoveryRecommendation(services, { diagnosis: diagnostics }).actions;
}

function executeSafeRecovery(action = '', services = {}) {
  return executeRecoveryAction(action, services, { confirmedByAdmin: true });
}

function listRecoveryActions() {
  return [
    { action: 'prune_volatile_telemetry', description: 'Prune active telemetry state events and samples.' },
    { action: 'clear_ops_caches', description: 'Clear volatile operations profiler lists.' },
    { action: 'switch_to_fallback_provider', description: 'Force AI routing to fallback/cooldown provider.' },
    { action: 'cooldown_circuit_breakers', description: 'Manually cooldown circuit breaker thresholds.' },
    { action: 'enable_lightweight_routing', description: 'Switch routing policy to simplified adaptive mode.' }
  ];
}

module.exports = {
  getRecoveryRecommendation,
  executeRecoveryAction,
  getRecoveryRecommendations,
  executeSafeRecovery,
  listRecoveryActions
};
