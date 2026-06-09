'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // Get built-in connectors
  const connectors = plugins.connectorRegistry.getBuiltInConnectors();
  assert(connectors.length >= 15, 'getBuiltInConnectors returns 15+ connectors');
  assert(connectors.length === 15, 'getBuiltInConnectors returns exactly 15');

  // Check first connector details
  const http = connectors.find(c => c.id === 'http_webhook');
  assert(http, 'http_webhook exists');
  assert(http.name === 'HTTP Webhook', 'http_webhook name correct');
  assert(http.category === 'network', 'http_webhook category network');
  assert(http.builtIn === true, 'http_webhook is builtIn');

  const slack = connectors.find(c => c.id === 'slack_webhook');
  assert(slack, 'slack_webhook exists');
  assert(slack.category === 'messaging', 'slack category messaging');

  // findConnectorRegistry
  const found = plugins.connectorRegistry.findConnectorRegistry('github_api');
  assert(found && found.name === 'GitHub API', 'findConnectorRegistry github_api');
  assert(found.authMethods.includes('oauth'), 'github_api supports oauth');

  const notFound = plugins.connectorRegistry.findConnectorRegistry('nonexistent');
  assert(notFound === null, 'findConnectorRegistry nonexistent returns null');

  // listConnectorCategories
  const cats = plugins.connectorRegistry.listConnectorCategories();
  assert(cats.includes('network'), 'categories includes network');
  assert(cats.includes('messaging'), 'categories includes messaging');
  assert(cats.includes('storage'), 'categories includes storage');
  assert(cats.includes('devtools'), 'categories includes devtools');
  assert(cats.length === 9, 'categories list has 9 items');

  // Returned connectors are copies (immutable)
  const firstBatch = plugins.connectorRegistry.getBuiltInConnectors();
  const secondBatch = plugins.connectorRegistry.getBuiltInConnectors();
  assert(firstBatch.length === secondBatch.length, 'getBuiltInConnectors consistent');
  assert(firstBatch[0] !== secondBatch[0], 'getBuiltInConnectors returns copies');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
