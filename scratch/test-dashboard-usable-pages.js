'use strict';

const fs = require('fs');
const assert = require('assert');

const ui = fs.readFileSync('public/dashboard/ui.js', 'utf8');
const githubops = fs.readFileSync('public/dashboard/githubops.js', 'utf8');
const deploy = fs.readFileSync('public/dashboard/deploy.js', 'utf8');
const index = fs.readFileSync('public/dashboard/index.html', 'utf8');
const api = fs.readFileSync('public/dashboard/api.js', 'utf8');

function methodExists(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\s*:\\s*(async\\s+)?function\\b`).test(ui)
    || new RegExp(`\\b${escaped}\\s*\\([^)]*\\)\\s*\\{`).test(ui);
}

assert(!/module belum tersedia atau belum termuat/i.test(ui), 'Public dashboard tabs must not show module-unavailable placeholders.');
assert(!/Workspace module belum tersedia|User management module belum tersedia|Audit log module belum tersedia/i.test(ui), 'Old placeholder copy must be removed.');
assert(/const BASE = '\/githubops';/.test(githubops), 'GitHub Ops helper must use Api-relative base path.');
assert(/const BASE = '\/deploy';/.test(deploy), 'Deploy helper must use Api-relative base path.');
assert(!/const BASE = ['"]\/api\/dashboard\//.test(githubops + deploy), 'Frontend helpers must not double-prefix /api/dashboard.');
assert(methodExists('_ghAction'), 'GitHub Ops buttons require UI._ghAction.');
assert(methodExists('_dpAction'), 'Deploy buttons require UI._dpAction.');

const onclickMethods = [...ui.matchAll(/onclick="UI\.([A-Za-z0-9_]+)\(/g)].map(match => match[1]);
for (const method of onclickMethods) {
  assert(methodExists(method), `onclick references missing UI method: ${method}`);
}

const apiCalls = [...new Set([...ui.matchAll(/Api\.([A-Za-z0-9_]+)/g)].map(match => match[1]))];
for (const method of apiCalls) {
  assert(api.includes(`${method}:`) || api.includes(`${method}(`), `UI references missing Api method: ${method}`);
}

const publicTabs = [...index.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]);
for (const tab of publicTabs) {
  assert(new RegExp(`${tab}:|['"]${tab}['"]:`).test(fs.readFileSync('public/dashboard/state.js', 'utf8')), `Menu tab missing state entry: ${tab}`);
}

console.log('test-dashboard-usable-pages: ok');
