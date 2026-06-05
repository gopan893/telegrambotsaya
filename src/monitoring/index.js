'use strict';

const { createEventBus } = require('./event-bus');
const { createMetricsStore } = require('./metrics-store');
const { createRealtimeHealth } = require('./monitoring-sanitizer');
const { initWebSocketServer } = require('./websocket-server');
const utils = require('./monitoring-utils');

function createMonitoringSystem(httpServer, services) {
  const eventBus = createEventBus();
  const metricsStore = createMetricsStore();
  const realtimeHealth = createRealtimeHealth(eventBus, metricsStore);
  const wsServer = initWebSocketServer(httpServer, services);

  function emit(topic, severity, title, summary, source) {
    const event = eventBus.emit({ type: 'monitor', topic, severity, title, summary, source: source || 'system' });
    wsServer.broadcast(event);
    return event;
  }

  return { eventBus, metricsStore, realtimeHealth, wsServer, utils, emit };
}

module.exports = { createMonitoringSystem };
