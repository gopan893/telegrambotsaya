'use strict';

const utils = require('./monitoring-utils');

function initWebSocketServer(httpServer, services) {
  let wss = null;
  let clients = new Set();
  let fallbackActive = false;

  try {
    const WebSocket = require('ws');
    if (httpServer && WebSocket) {
      wss = new WebSocket.Server({ server: httpServer, path: '/ws' });
      wss.on('connection', (ws, req) => {
        if (!authenticate(req)) { ws.close(4001, 'Unauthorized'); return; }
        const client = { ws, id: utils.generateId('ws'), topics: new Set(['health']), authenticatedAt: new Date().toISOString() };
        clients.add(client);
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
              msg.topics.forEach(t => { if (utils.TOPICS.includes(t)) client.topics.add(t); });
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

  function authenticate(req) {
    if (!req) return true;
    const token = req.headers?.['x-dashboard-token'] || req.headers?.['authorization']?.replace('Bearer ', '') || '';
    if (!token && services.env?.DASHBOARD_ADMIN_TOKEN) return false;
    return true;
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

  setInterval(cleanupStale, 30000);

  return { wss, clients, broadcast, cleanupStale, getClientCount, fallbackActive };
}

module.exports = { initWebSocketServer };
