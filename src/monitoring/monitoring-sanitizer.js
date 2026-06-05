'use strict';

function createRealtimeHealth(eventBus, metricsStore) {
  function buildHealthPayload(services) {
    const payload = { status: 'ok', timestamp: new Date().toISOString(), checks: [] };
    try {
      if (services.storageManager) payload.redis = 'checking';
      if (services.selfHealingSystem) payload.selfhealing = 'active';
      if (services.cicdSystem) payload.cicd = 'configured';
      if (services.evaluationSystem) payload.evaluation = 'loaded';
    } catch (_) {}
    return payload;
  }

  function emitHealthEvent(severity, title, summary, topic) {
    return eventBus.emit({ type: 'health', topic: topic || 'health', severity: severity || 'info', title: title || 'Health check', summary: summary || '', source: 'realtime-health' });
  }

  function getSnapshot() {
    return { metrics: metricsStore.snapshot(), events: eventBus.getHistory({ topic: 'health' }).slice(-20) };
  }

  return { buildHealthPayload, emitHealthEvent, getSnapshot };
}

module.exports = { createRealtimeHealth };
