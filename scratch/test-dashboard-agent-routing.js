'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/dashboard/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/dashboard/app.js'), 'utf8');
const state = fs.readFileSync(path.join(root, 'public/dashboard/state.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/dashboard/service-worker.js'), 'utf8');

const sandbox = {
  window: {},
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  }
};
vm.runInNewContext(state, sandbox);
const DashboardState = sandbox.window.DashboardState;

assert(html.includes('href="#agents" data-tab="agents"'), 'Agents nav must point to #agents with data-tab agents');
assert(html.includes('Agents'), 'Agents menu label should exist');
assert.strictEqual(DashboardState.findTabId('agents'), 'agents', 'Agents tab must resolve via DASHBOARD_TABS');
assert.strictEqual(DashboardState.getTabConfig('agents').renderer, 'renderAgents', 'Agents tab renderer must be renderAgents');
assert.strictEqual(DashboardState.findTabId('multibot'), 'agents', 'Agents alias multibot should resolve');
assert(app.includes('DashboardState.findTabId'), 'Dashboard router should use registry-based tab lookup');
assert(app.includes('e.preventDefault()'), 'Nav click should prevent default anchor fallback');
assert(app.includes("rawHash ? 'overview' : DashboardState.restoreLastTab()"), 'Unknown explicit tab should fall back to overview');
assert(app.includes('ensureRenderedContent'), 'Router should guard against blank tab content');
assert(sw.includes('telegram-aios-dashboard-static-v34-phase37-observability'), 'PWA cache version should be bumped');
assert(!/api\/dashboard.*cache\.put|cache\.put.*api\/dashboard/i.test(sw), 'Service worker must not cache dashboard API responses');
assert(!/\d{8,12}:[A-Za-z0-9_-]{20,}|postgresql:\/\/|rediss?:\/\/|sk-[a-z0-9_-]{4,}/i.test(html + app + sw), 'Dashboard static routing assets must not leak secret values');

console.log('test-dashboard-agent-routing: ok');
