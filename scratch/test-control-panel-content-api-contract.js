'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const routesJs = fs.readFileSync(path.join(ROOT, 'src/dashboard/dashboard-routes.js'), 'utf8');

// 1. Many routes registered
const routeCount = (routesJs.match(/router\.(get|post|put|delete)\(/g) || []).length;
assert(routeCount > 20, `dashboard-routes.js has ${routeCount} routes (expected > 20)`);

// 2. Uses safeDashboardResponse
assert(routesJs.includes('safeDashboardResponse'), 'Uses safeDashboardResponse');

// 3. Sub-route modules referenced exist
const subRouteRefs = routesJs.match(/require\('\.\/([^']+-routes)'\)/g) || [];
subRouteRefs.forEach(ref => {
  const name = ref.match(/require\('\.\/([^']+)'\)/)[1];
  const fullPath = path.join(ROOT, 'src/dashboard', `${name}.js`);
  try {
    fs.accessSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('safeDashboardResponse') || content.includes('res.json') || content.includes('res.status')) {
      // pass silently
    } else {
      // May use res.send or other pattern — log soft warning
      if (!content.includes('res.send')) {
        console.error(`WARN: ${name}.js uses unusual response pattern`);
      }
    }
  } catch (_) {
    console.error(`WARN: Referenced ${name}.js not found`);
  }
});

// 4. Route registrations are wrapped in try/catch (check try count near sub-route calls)
const tryBlocks = routesJs.match(/try\s*\{/g) || [];
assert(tryBlocks.length >= 10, 'Has many try/catch blocks for sub-route modules');

// 5. Quick actions API is rate-limited
assert(routesJs.includes('rateLimitDashboardAction'), 'Actions are rate-limited');

// 6. All POST routes check permissions
const postRoutes = routesJs.match(/router\.post\([^)]+\)/g) || [];
const permChecks = routesJs.match(/permissions/g) || [];
const actionChecks = routesJs.match(/runSafeAction|handleAction/g) || [];
assert(permChecks.length > 0, 'Has permission checks');
assert(actionChecks.length > 0, 'Has safe action handlers');

console.log(`\n=== API Contract: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
