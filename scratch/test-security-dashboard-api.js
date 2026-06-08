'use strict';

let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. Module exports registerSecurityRoutes function
let routes;
try {
  routes = require('../src/dashboard/security-routes');
  pass++;
} catch (e) {
  console.error(`FAIL: require security-routes failed: ${e.message}`);
  fail++;
}

// 2. Check exports
assert(typeof routes.registerSecurityRoutes === 'function', 'registerSecurityRoutes is a function');

// 3. Test that calling registerSecurityRoutes with mock router doesn't crash
const mockRouter = {
  _routes: [],
  use(path, fn) { this._routes.push({ method: 'use', path, fn }); },
  get(path, fn) { this._routes.push({ method: 'get', path, fn }); },
  post(path, fn) { this._routes.push({ method: 'post', path, fn }); }
};
const mockServices = { env: { TELEGRAM_TOKEN: 'test', DASHBOARD_ADMIN_TOKEN: 'test', OWNER_CHAT_ID: '1', ADMIN_IDS: '1', STORAGE_DRIVER: 'postgres', DATABASE_URL: 'x', AI_PROVIDER: 'openai', NODE_ENV: 'development', PORT: '3000', WEBHOOK_URL: 'https://example.com' } };

try {
  routes.registerSecurityRoutes(mockRouter, mockServices);
  pass++;
} catch (e) {
  console.error(`FAIL: registerSecurityRoutes threw: ${e.message}`);
  fail++;
}

// 4. Verify routes were registered
assert(mockRouter._routes.length > 0, 'Routes were registered on mock router');
assert(mockRouter._routes.some(r => r.path && r.path.includes('/api/dashboard/security')), 'Has /api/dashboard/security routes');

// 5. Verify each handler is async function
const handlerRoutes = mockRouter._routes.filter(r => r.method === 'get' || r.method === 'post');
handlerRoutes.forEach((r, i) => {
  assert(typeof r.fn === 'function', `Route handler ${i} is a function`);
});

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
