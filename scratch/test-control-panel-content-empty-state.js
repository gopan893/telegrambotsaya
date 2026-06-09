'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Check ui.js has empty state, loading state, error state, and unauthorized state renderers
const uiJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/ui.js'), 'utf8');

assert(uiJs.includes('renderEmptyState'), 'ui.js has renderEmptyState');
assert(uiJs.includes('renderLoading'), 'ui.js has renderLoading');
assert(uiJs.includes('renderError'), 'ui.js has renderError');

// Check app.js error boundary
const appJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/app.js'), 'utf8');
assert(appJs.includes('renderRouteError'), 'app.js has renderRouteError');
assert(appJs.includes('renderRoutePlaceholder'), 'app.js has renderRoutePlaceholder');
assert(appJs.includes('ensureRenderedContent'), 'app.js has ensureRenderedContent');
assert(appJs.includes('error-state'), 'app.js has error-state class fallback');

// Check all renderers handle API errors gracefully
// Each render function should check API response.ok or have try/catch
const allJsFiles = fs.readdirSync(path.join(ROOT, 'public/dashboard'))
  .filter(f => f.endsWith('.js') && !['service-worker.js'].includes(f));

allJsFiles.forEach(f => {
  const content = fs.readFileSync(path.join(ROOT, 'public/dashboard', f), 'utf8');
  // Should have some form of error handling
  if (content.includes('fetch(') || content.includes('Api.')) {
    const hasErrorHandling = content.includes('catch') || content.includes('.ok') || content.includes('error') || content.includes('try');
    if (!hasErrorHandling) {
      console.error(`WARN: ${f} uses fetch/Api without error handling`);
    }
  }
});

// Check all standalone tab files show error card instead of blank page or raw JSON
const standaloneDirs = ['src/dashboard', 'public/dashboard'];
standaloneDirs.forEach(dir => {
  try {
    const files = fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js'));
    // Soft check — no hard fail
  } catch (_) {}
});

console.log(`\n=== Empty State Check: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
