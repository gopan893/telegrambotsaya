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

  function attachWebSocket(newHttpServer) {
    if (!newHttpServer) return;
    try {
      const WebSocket = require('ws');
      if (WebSocket && !wsServer.fallbackActive) return;
      const { initWebSocketServer: initWS } = require('./websocket-server');
      const newWs = initWS(newHttpServer, services);
      wsServer.wss = newWs.wss;
      wsServer.clients = newWs.clients;
      wsServer.fallbackActive = newWs.fallbackActive;
    } catch (_) {}
  }

  return { eventBus, metricsStore, realtimeHealth, wsServer, utils, emit, attachWebSocket };
}

module.exports = { createMonitoringSystem };
