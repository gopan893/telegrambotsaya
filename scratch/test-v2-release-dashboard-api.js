'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const dashPath = path.join(ROOT, 'public/dashboard/v2-release.js');
  const dashContent = require('fs').readFileSync(dashPath, 'utf8');
  assert.ok(dashContent.includes('UI.renderV2Release'), 'public/dashboard/v2-release.js contains UI.renderV2Release');

  const routesMod = require(path.join(ROOT, 'src/dashboard/v2-release-routes'));
  assert.ok(routesMod.registerV2ReleaseRoutes, 'src/dashboard/v2-release-routes.js exports registerV2ReleaseRoutes');

  console.log('PASS: test-v2-release-dashboard-api — UI.renderV2Release exists; registerV2ReleaseRoutes exported');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
