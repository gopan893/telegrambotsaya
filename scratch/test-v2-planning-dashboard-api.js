'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const publicFile = path.join(ROOT, 'public/dashboard/v2-planning.js');
  assert.ok(fs.existsSync(publicFile), 'public/dashboard/v2-planning.js exists');
  const publicContent = fs.readFileSync(publicFile, 'utf8');
  assert.ok(publicContent.includes('window.UI') || publicContent.includes('UI.'), 'v2-planning.js contains window.UI references');

  const routesFile = path.join(ROOT, 'src/dashboard/v2-planning-routes.js');
  assert.ok(fs.existsSync(routesFile), 'src/dashboard/v2-planning-routes.js exists');
  const routesMod = require(routesFile);
  assert.ok(typeof routesMod.registerV2PlanningRoutes === 'function', 'registerV2PlanningRoutes is exported function');

  console.log('PASS: test-v2-planning-dashboard-api — public file exists with UI refs, routes file exports registerV2PlanningRoutes');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
