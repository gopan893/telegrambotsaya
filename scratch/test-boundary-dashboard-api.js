'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const boundaryJsPath = path.join(ROOT, 'public/dashboard/boundary.js');
  const boundaryRoutesPath = path.join(ROOT, 'src/dashboard/boundary-routes.js');

  assert.ok(fs.existsSync(boundaryJsPath), 'public/dashboard/boundary.js should exist');
  const boundaryJsContent = fs.readFileSync(boundaryJsPath, 'utf8');
  assert.ok(boundaryJsContent.includes('UI.renderBoundary'), 'boundary.js should contain UI.renderBoundary');

  assert.ok(fs.existsSync(boundaryRoutesPath), 'src/dashboard/boundary-routes.js should exist');
  const routesMod = require(boundaryRoutesPath);
  assert.ok(routesMod.registerBoundaryRoutes, 'boundary-routes.js should export registerBoundaryRoutes');

  console.log('PASS: test-boundary-dashboard-api — boundary.js exists with UI.renderBoundary, boundary-routes.js exports registerBoundaryRoutes');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
