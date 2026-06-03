'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`\x1b[32m✅ ${name}\x1b[0m`); passed++; }
  catch (err) { console.log(`\x1b[31m❌ ${name}: ${err.message}\x1b[0m`); failed++; }
}

// ---- Simulate the routing logic ----

const TAB_RENDERERS = {
  overview: 'UI.renderOverview',
  ops: 'UI.renderOps',
  memory: 'UI.renderMemory',
  goals: 'UI.renderGoals',
  workflows: 'UI.renderWorkflows',
  insights: 'UI.renderInsights',
  graph: 'UI.renderGraph',
  benchmarks: 'UI.renderBenchmarks',
  incidents: 'UI.renderIncidents',
  commands: 'UI.renderCommands',
  env: 'UI.renderEnv',
  settings: 'UI.renderSettings',
  agents: 'UI.renderAgents',
  integrations: 'UI.renderIntegrations',
  coding: 'UI.renderCodingWorkspace',
  release: 'UI.renderRelease',
  routines: 'UI.renderRoutines'
};

const ALIAS_MAP = {
  'coding-workspace': 'coding',
  'codingworkspace': 'coding',
  'coding_workspace': 'coding',
  'code-workspace': 'coding',
  'release-health': 'release',
  'releasecheck': 'release',
  'release-check': 'release',
  'routines': 'routines'
};

function normalizeTabAlias(hash) {
  if (ALIAS_MAP[hash]) return ALIAS_MAP[hash];
  return hash || 'overview';
}

function getRenderer(tab) {
  const hash = normalizeTabAlias(tab);
  return TAB_RENDERERS[hash] || null;
}

// ---- Tests ----

test('Coding Workspace tab (coding) resolves to renderCodingWorkspace', () => {
  assert.strictEqual(getRenderer('coding'), 'UI.renderCodingWorkspace');
});

test('Release tab (release) resolves to renderRelease', () => {
  assert.strictEqual(getRenderer('release'), 'UI.renderRelease');
});

test('#coding-workspace alias resolves to coding -> renderCodingWorkspace', () => {
  assert.strictEqual(getRenderer('coding-workspace'), 'UI.renderCodingWorkspace');
});

test('#codingworkspace alias resolves to renderCodingWorkspace', () => {
  assert.strictEqual(getRenderer('codingworkspace'), 'UI.renderCodingWorkspace');
});

test('#coding_workspace alias resolves to renderCodingWorkspace', () => {
  assert.strictEqual(getRenderer('coding_workspace'), 'UI.renderCodingWorkspace');
});

test('#code-workspace alias resolves to renderCodingWorkspace', () => {
  assert.strictEqual(getRenderer('code-workspace'), 'UI.renderCodingWorkspace');
});

test('#release-health alias resolves to renderRelease', () => {
  assert.strictEqual(getRenderer('release-health'), 'UI.renderRelease');
});

test('#releasecheck alias resolves to renderRelease', () => {
  assert.strictEqual(getRenderer('releasecheck'), 'UI.renderRelease');
});

test('#release-check alias resolves to renderRelease', () => {
  assert.strictEqual(getRenderer('release-check'), 'UI.renderRelease');
});

test('Unknown tab returns null (not Overview)', () => {
  assert.strictEqual(getRenderer('nonexistent-tab-xyz'), null);
});

test('Empty hash returns overview', () => {
  assert.strictEqual(getRenderer(''), 'UI.renderOverview');
});

test('Routines tab resolves', () => {
  assert.strictEqual(getRenderer('routines'), 'UI.renderRoutines');
});

// ---- Check app.js for normalizeTabAlias function ----

const appJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf-8');

test('app.js contains normalizeTabAlias function', () => {
  assert.ok(appJs.includes('function normalizeTabAlias'), 'normalizeTabAlias should be defined in app.js');
});

test('app.js contains alias for coding-workspace', () => {
  assert.ok(appJs.includes("'coding-workspace'"), 'coding-workspace alias should exist');
});

test('app.js contains alias for release-health', () => {
  assert.ok(appJs.includes("'release-health'"), 'release-health alias should exist');
});

test('app.js default case shows placeholder for unknown known tabs', () => {
  assert.ok(appJs.includes('Page module belum tersedia'), 'Default case should show placeholder');
});

test('app.js nav items prevent default on click', () => {
  assert.ok(appJs.includes('e.preventDefault()'), 'Nav click should call preventDefault');
});

// ---- Check service worker ----

const swPath = path.join(__dirname, '..', 'public', 'dashboard', 'service-worker.js');
const sw = fs.readFileSync(swPath, 'utf-8');

test('Service worker excludes /api/dashboard/ from cache', () => {
  assert.ok(sw.includes('/api/dashboard'), 'SW should check for /api/dashboard/');
  assert.ok(sw.includes("url.pathname.startsWith('/api/dashboard')"), 'SW should use startsWith on /api/dashboard');
});

test('No secrets or tokens leaked in CSS', () => {
  const cssPath = path.join(__dirname, '..', 'public', 'dashboard', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf-8');
  const secrets = ['ghp_', 'sk-', 'TELEGRAM_TOKEN', 'GITHUB_TOKEN', 'DASHBOARD_ADMIN_TOKEN', 'DATABASE_URL'];
  for (const secret of secrets) {
    assert.ok(!css.includes(secret), `CSS should not contain ${secret}`);
  }
});

test('No secrets or tokens leaked in app.js', () => {
  const secrets = ['ghp_', 'sk-', 'TELEGRAM_TOKEN', 'GITHUB_TOKEN', 'DASHBOARD_ADMIN_TOKEN', 'DATABASE_URL'];
  for (const secret of secrets) {
    assert.ok(!appJs.includes(secret), `app.js should not contain ${secret}`);
  }
});

// ---- Check HTML sidebar ----

const htmlPath = path.join(__dirname, '..', 'public', 'dashboard', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

test('HTML has Coding Workspace nav link with data-tab="coding"', () => {
  assert.ok(html.includes('data-tab="coding"'), 'Coding nav should have data-tab="coding"');
});

test('HTML has Release nav link with data-tab="release"', () => {
  assert.ok(html.includes('data-tab="release"'), 'Release nav should have data-tab="release"');
});

test('HTML Coding Workspace link shows correct label', () => {
  assert.ok(html.includes('Coding Workspace'), 'Coding nav should show Coding Workspace');
});

test('HTML Release link shows correct label', () => {
  assert.ok(html.includes('Release'), 'Release nav should show Release');
});

console.log(`\n📊 Coding/Release Routing Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
