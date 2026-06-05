'use strict';

const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const { initWebSocketServer, authenticateWebSocketClient } = require('../src/monitoring/websocket-server');

function encodeProtocolToken(token) {
  return Buffer.from(token, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function waitOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function waitMessage(buffer, ws, timeoutMs = 3000) {
  if (buffer.length) return Promise.resolve(buffer.shift());
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = setInterval(() => {
      if (buffer.length) {
        clearInterval(interval);
        resolve(buffer.shift());
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Timed out waiting for WebSocket message'));
      }
    }, 25);
  });
}

async function run() {
  const env = { DASHBOARD_ADMIN_TOKEN: 'ws-test-token' };
  assert.strictEqual(authenticateWebSocketClient({ url: '/ws', headers: {} }, { env }).ok, false, 'missing token rejected');
  assert.strictEqual(authenticateWebSocketClient({ url: '/ws?token=bad', headers: {} }, { env }).ok, false, 'bad token rejected');
  assert.strictEqual(authenticateWebSocketClient({ url: '/ws', headers: { authorization: 'Bearer ws-test-token' } }, { env }).ok, true, 'bearer token accepted');

  const server = http.createServer((req, res) => res.end('ok'));
  const wsServer = initWebSocketServer(server, { env });
  const port = await listen(server);
  const token = encodeProtocolToken('ws-test-token');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['dashboard', `dashboard-auth.${token}`]);
  const buffer = [];
  ws.on('message', data => buffer.push(JSON.parse(String(data))));
  await waitOpen(ws);
  const connected = await waitMessage(buffer, ws);
  assert.strictEqual(connected.type, 'connected', 'client connects with dashboard token protocol');

  ws.send(JSON.stringify({ type: 'subscribe', topics: ['health'] }));
  wsServer.broadcast({ topic: 'health', title: 'secret sk-test1234', summary: 'ok' });
  const event = await waitMessage(buffer, ws);
  assert(!JSON.stringify(event).includes('sk-test1234'), 'websocket event sanitized');

  ws.close();
  server.close();
  console.log('test-websocket-monitoring: ok');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
