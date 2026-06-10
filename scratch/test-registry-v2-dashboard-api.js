'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const dashboardJsPath = path.join(ROOT, 'public/dashboard/registry-v2.js');
  const routesJsPath = path.join(ROOT, 'src/dashboard/registry-v2-routes.js');

  assert.ok(fs.existsSync(dashboardJsPath), 'public/dashboard/registry-v2.js exists');
  const dashboardContent = fs.readFileSync(dashboardJsPath, 'utf8');
  assert.ok(dashboardContent.includes('UI.renderRegistryV2'), 'UI.renderRegistryV2 is defined');

  assert.ok(fs.existsSync(routesJsPath), 'src/dashboard/registry-v2-routes.js exists');
  const routesMod = require(routesJsPath);
  assert.ok(routesMod.registerRegistryV2Routes, 'registerRegistryV2Routes is exported');
  assert.strictEqual(typeof routesMod.registerRegistryV2Routes, 'function', 'registerRegistryV2Routes is a function');

  console.log('PASS: registry-v2-dashboard-api — both files exist with expected exports');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
