'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/dashboard/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/dashboard/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/dashboard/service-worker.js'), 'utf8');

assert(html.includes('href="#agents" data-tab="agents"'), 'Agents nav must point to #agents with data-tab agents');
assert(html.includes('Agents'), 'Agents menu label should exist');
assert(app.includes('agents: UI.renderAgents'), 'Agents tab must be registered in TAB_ROUTES');
assert(app.includes('normalizeTab'), 'Dashboard router should normalize tab ids');
assert(app.includes('getRequestedTab'), 'Dashboard router should support hash/query tab restore');
assert(app.includes('e.preventDefault()'), 'Nav click should prevent default anchor fallback');
assert(app.includes("return normalizeTab(queryTab)"), 'Dashboard should support /dashboard?tab=agents');
assert(app.includes("? clean : 'overview'"), 'Unknown tab should fall back to overview');
assert(sw.includes('telegram-aios-dashboard-static-v28'), 'PWA cache version should be bumped');
assert(!/api\/dashboard.*cache\.put|cache\.put.*api\/dashboard/i.test(sw), 'Service worker must not cache dashboard API responses');
assert(!/8617592038:|postgresql:\/\/|rediss?:\/\/|sk-[a-z0-9_-]{4,}/i.test(html + app + sw), 'Dashboard static routing assets must not leak secret values');

console.log('test-dashboard-agent-routing: ok');
