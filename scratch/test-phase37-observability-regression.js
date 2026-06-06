'use strict';

const assert = require('assert');
const fs = require('fs');

const state = fs.readFileSync('public/dashboard/state.js', 'utf8');
const html = fs.readFileSync('public/dashboard/index.html', 'utf8');
const sw = fs.readFileSync('public/dashboard/service-worker.js', 'utf8');
const ui = fs.readFileSync('public/dashboard/observability.js', 'utf8');

assert(state.includes('observability') && state.includes('renderObservability'), 'observability tab registered');
assert(html.includes('data-tab="observability"') && html.includes('#observability'), 'observability menu exists');
assert(html.includes('/dashboard/observability.js?v=20260606-phase37-observability'), 'observability asset loaded with cache bust');
assert(sw.includes('/dashboard/observability.js'), 'service worker caches static observability asset');
assert(sw.includes("url.pathname.startsWith('/api/dashboard')"), 'service worker does not cache dashboard API responses');
assert(ui.includes('UI.renderObservability'), 'observability renderer attached to UI');
assert(!html.includes('DATABASE_URL') && !ui.includes('TELEGRAM_TOKEN'), 'no secret names exposed in public UI');
console.log('test-phase37-observability-regression: ok');
