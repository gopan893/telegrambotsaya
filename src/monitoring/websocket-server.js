'use strict';

const utils = require('./monitoring-utils');

function decodeProtocolToken(protocolHeader = '') {
  const parts = String(protocolHeader || '').split(',').map(part => part.trim()).filter(Boolean);
  const encoded = parts.find(part => part.startsWith('dashboard-auth.'));
  if (!encoded) return '';
  try {
    const value = encoded.slice('dashboard-auth.'.length).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (_) {
    return '';
  }
}

function authenticateWebSocketClient(req, services = {}) {
  const expected = services.env?.DASHBOARD_ADMIN_TOKEN || process.env.DASHBOARD_ADMIN_TOKEN || '';
  if (!expected) return { ok: false, reason: 'dashboard_token_missing' };
  const url = new URL(req?.url || '/ws', 'http://localhost');
  const headerToken = req?.headers?.['x-dashboard-token'] || '';
  const authToken = String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const queryToken = url.searchParams.get('token') || url.searchParams.get('auth') || '';
  const protocolToken = decodeProtocolToken(req?.headers?.['sec-websocket-protocol']);
  const token = headerToken || authToken || queryToken || protocolToken;
  if (!token) return { ok: false, reason: 'missing_token' };
  return token === expected ? { ok: true } : { ok: false, reason: 'invalid_token' };
}

function subscribeClient(client, topics = []) {
  if (!client || !client.topics) return false;
  topics.forEach(topic => {
    if (utils.TOPICS.includes(topic) || topic === '*') client.topics.add(topic);
  });
  return true;
}

function initWebSocketServer(httpServer, services) {
  let wss = null;
  let clients = new Set();
  let fallbackActive = false;

  try {
    const WebSocket = require('ws');
    if (httpServer && WebSocket) {
      wss = new WebSocket.Server({ server: httpServer, path: '/ws' });
      wss.on('connection', (ws, req) => {
        const auth = authenticateWebSocketClient(req, services);
        if (!auth.ok) { ws.close(4001, 'Unauthorized'); return; }
        const client = { ws, id: utils.generateId('ws'), topics: new Set(['health']), authenticatedAt: new Date().toISOString() };
        clients.add(client);
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
              subscribeClient(client, msg.topics);
            }
            if (msg.type === 'unsubscribe' && Array.isArray(msg.topics)) {
              msg.topics.forEach(t => client.topics.delete(t));
            }
            if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
          } catch (_) {}
        });
        ws.on('close', () => clients.delete(client));
        ws.on('error', () => clients.delete(client));
        ws.send(JSON.stringify({ type: 'connected', clientId: client.id }));
      });
    }
  } catch (e) {
    fallbackActive = true;
  }

  function broadcast(event) {
    const sanitized = utils.sanitize(event);
    const msg = JSON.stringify(sanitized);
    if (wss) {
      clients.forEach(c => {
        if (c.topics.has(sanitized.topic) || c.topics.has('*')) {
          try { c.ws.send(msg); } catch (_) { clients.delete(c); }
        }
      });
    }
    return true;
  }

  function cleanupStale() {
    if (!wss) return;
    clients.forEach(c => {
      if (c.ws.readyState !== 1) clients.delete(c);
    });
  }

  function getClientCount() { return clients.size; }

  function sendHeartbeat(client) {
    try {
      if (client?.ws?.readyState === 1) client.ws.send(JSON.stringify({ type: 'heartbeat', at: utils.nowISO() }));
      return true;
    } catch (_) {
      return false;
    }
  }

  const interval = setInterval(cleanupStale, 30000);
  if (interval.unref) interval.unref();

  return { wss, clients, broadcast, cleanupStale, getClientCount, fallbackActive, sendHeartbeat };
}

function broadcastMonitoringEvent(event, services = {}) {
  return services.monitoringSystem?.wsServer?.broadcast?.(event) || false;
}

module.exports = {
  initWebSocketServer,
  authenticateWebSocketClient,
  subscribeClient,
  broadcastMonitoringEvent
};
