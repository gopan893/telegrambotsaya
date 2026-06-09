'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // createConnectorInstance
  const instance = plugins.connectorFactory.createConnectorInstance('http_webhook', { url: 'https://example.com/hook' });
  assert(instance !== null, 'createConnectorInstance succeeds');
  assert(instance.connectorId === 'http_webhook', 'instance connectorId set');
  assert(instance.name === 'HTTP Webhook', 'instance name set');
  assert(instance.status === 'disconnected', 'initial status disconnected');
  assert(instance.connected === false, 'initial connected false');
  assert(instance.config.url === 'https://example.com/hook', 'config passed through');

  const nullInstance = plugins.connectorFactory.createConnectorInstance('nonexistent', {});
  assert(nullInstance === null, 'unknown connector returns null');

  // connectConnector
  const connectResult = await plugins.connectorFactory.connectConnector(instance.id, { token: 'abc' });
  assert(connectResult.ok === true, 'connectConnector succeeds');
  assert(connectResult.instance.connected === true, 'instance connected after connect');
  assert(connectResult.instance.status === 'connected', 'status connected');

  // Double connect
  const reconnect = await plugins.connectorFactory.connectConnector(instance.id, {});
  assert(reconnect.ok === true, 'double connect ok');
  assert(reconnect.status === 'already_connected', 'already connected status');

  // Connect nonexistent
  const badConnect = await plugins.connectorFactory.connectConnector('nobody_home', {});
  assert(badConnect.ok === false, 'connect nonexistent fails');
  assert(badConnect.error === 'Connector not found', 'correct error message');

  // disconnectConnector
  const disconnectResult = await plugins.connectorFactory.disconnectConnector(instance.id);
  assert(disconnectResult.ok === true, 'disconnectConnector succeeds');

  const connAfterDisconnect = plugins.pluginStore.getConnector(instance.id);
  assert(connAfterDisconnect.connected === false, 'disconnected state');

  // Disconnect nonexistent
  const badDisconnect = await plugins.connectorFactory.disconnectConnector('nobody_home');
  assert(badDisconnect.ok === false, 'disconnect nonexistent fails');

  // getConnectorAuthSchema
  const schema = plugins.connectorFactory.getConnectorAuthSchema('http_webhook');
  assert(schema !== null, 'getConnectorAuthSchema returns schema');
  assert(schema.authMethods.includes('bearer'), 'schema includes bearer');
  assert(schema.type === 'webhook', 'schema type webhook');
  assert(schema.category === 'network', 'schema category network');

  const nullSchema = plugins.connectorFactory.getConnectorAuthSchema('nonexistent');
  assert(nullSchema === null, 'unknown connector schema null');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
