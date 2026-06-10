'use strict';

let pass = 0, fail = 0, warn = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/ui.js'), 'utf8');
const swJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/service-worker.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/app.js'), 'utf8');
const routeRegJs = fs.readFileSync(path.join(ROOT, 'src/dashboard/dashboard-routes.js'), 'utf8');

// Extract all tabs from state.js
const tabs = [];
const lines = stateJs.split('\n');
let currentId = null, currentConfig = {};
for (let i = 0; i < lines.length; i++) {
  const idMatch = lines[i].match(/^\s{2}(['\"]?)([\w-]+)\1\s*:\s*\{/);
  if (idMatch) {
    if (currentId) tabs.push({ id: currentId, ...currentConfig });
    currentId = idMatch[2];
    currentConfig = {};
  }
  const lbl = lines[i].match(/label:\s*'([^']+)'/);
  if (lbl && currentId) currentConfig.label = lbl[1];
  const ren = lines[i].match(/renderer:\s*'([^']+)'/);
  if (ren && currentId) currentConfig.renderer = ren[1];
  const vis = lines[i].match(/navVisible:\s*(true|false)/);
  if (vis && currentId) currentConfig.navVisible = vis[1] === 'true';
  const int = lines[i].match(/internalOnly:\s*(true|false)/);
  if (int && currentId) currentConfig.internalOnly = int[1] === 'true';
  const ali = lines[i].match(/aliases:\s*\[([^\]]+)\]/);
  if (ali && currentId) currentConfig.aliases = ali[1].split(',').map(a => a.trim().replace(/['"]/g, ''));
  if (lines[i].match(/^\s{2}\},/) && currentId) {
    tabs.push({ id: currentId, ...currentConfig });
    currentId = null; currentConfig = {};
  }
}
if (currentId) tabs.push({ id: currentId, ...currentConfig });

const publicTabs = tabs.filter(t => t.navVisible !== false && t.internalOnly !== true);

// Extract sidebar nav items
const sidebarDataTabs = [];
const sidebar = html.match(/<nav[^>]*id="nav-menu"[^>]*>([\s\S]*?)<\/nav>/);
if (sidebar) {
  const links = sidebar[1].match(/<a\s+[^>]*>/g) || [];
  links.forEach(a => {
    const dt = a.match(/data-tab="([^"]+)"/);
    const hr = a.match(/href="#([^"]+)"/);
    if (dt) sidebarDataTabs.push({ dataTab: dt[1], href: hr ? hr[1] : null });
  });
}

// Load standalone renderer files
const standaloneFiles = ['graph.js','observability.js','portfolio.js','research.js','lifeos.js','cicd.js','githubops.js','deploy.js','cost.js','knowledge.js','telegram-control.js','operating-loop.js','improvement.js','governance.js','security.js','privacy.js','release-candidate.js','production-release.js','reliability.js','docs-intel.js','model-router.js','plugins.js','operator.js','mobile.js','disaster-recovery.js','consolidation.js','rag-kb.js','recipes.js','stabilization.js','v2-planning.js','registry-v2.js','boundary.js','performance.js','v2-release.js','v2-stabilization.js','v2-production.js','post-v2.js','plugin-hardening.js','rag-quality.js','agent-runtime.js'];
const standaloneContents = {};
standaloneFiles.forEach(f => {
  try { standaloneContents[f] = fs.readFileSync(path.join(ROOT, 'public/dashboard', f), 'utf8'); }
  catch(e) { standaloneContents[f] = ''; }
});

// All script tags in order
const scriptMatches = html.match(/<script src="\/dashboard\/([^"]+)"/g) || [];
const scriptsLoaded = scriptMatches.map(s => s.match(/\/dashboard\/([^"?]+)/)[1]);

// Route files
const allRouteFiles = fs.readdirSync(path.join(ROOT, 'src/dashboard'));

console.log('\n=== BROKEN MENU MATRIX ===\n');
console.log('TAB ID'.padEnd(30) + 'SIDEBAR  HREF   RENDERER   SCRIPT   UI-REG   API-RTE   ALIAS');
console.log('-'.repeat(120));

// Build alias map (only among public tabs)
const aliasMap = {};
publicTabs.forEach(t => {
  (t.aliases || []).forEach(a => {
    if (!aliasMap[a]) aliasMap[a] = [];
    aliasMap[a].push(t.id);
  });
});

publicTabs.forEach(t => {
  const tabId = t.id;
  const renderer = t.renderer;

  // Sidebar
  const sidebarEntry = sidebarDataTabs.find(s => s.dataTab === tabId);
  const hasSidebar = Boolean(sidebarEntry);
  const hrefMatch = sidebarEntry ? sidebarEntry.dataTab === sidebarEntry.href : false;

  // Renderer exists in code
  const inUiJs = uiJs.includes(renderer + ':') || uiJs.includes(renderer + '(') || uiJs.includes(renderer + ' =');
  const inStandalone = Object.entries(standaloneContents).some(([f, c]) => c.includes(renderer + ':') || c.includes(renderer + ' =') || c.includes(renderer + '(') || c.includes('UI.' + renderer + ' ='));
  const hasRenderer = inUiJs || inStandalone;

  // UI registration (the render function is accessible via UI[rendererName])
  const uiRegistered = inUiJs || Object.entries(standaloneContents).some(([f, c]) => c.includes('UI.' + renderer + ' =') || c.includes('window.UI.' + renderer + ' ='));

  // Script loaded (standalone scripts only - ui.js is always loaded)
  const hasStandaloneScript = standaloneFiles.some(f => f === tabId + '.js' || f.startsWith(tabId + '.')) && scriptsLoaded.includes(tabId + '.js');

  // API route file
  const routePatterns = [tabId.replace(/-/g, '') + '-routes', tabId + '-routes', tabId.replace(/-/g, '_') + '-routes'];
  const hasRouteFile = routePatterns.some(p => allRouteFiles.includes(p + '.js'));
  // Known tabs with routes in dashboard-routes.js or inline
  const knownRouteNames = ['backup', 'planner', 'executor', 'tools', 'workspace', 'agent-memory', 'council', 'agent', 'agent-task', 'decision', 'agent-executor', 'agent-evaluation', 'integration-execution', 'selfhealing', 'monitoring', 'cicd', 'devgovernance', 'githubops', 'deploy', 'cost', 'knowledge', 'governance', 'security', 'privacy', 'release-candidate', 'production-release', 'reliability', 'plugin', 'rag-kb', 'recipe', 'mobile', 'disaster-recovery', 'consolidation', 'operator', 'research', 'docs-intel', 'model-router', 'lifeos', 'portfolio', 'improvement', 'telegram-control', 'observability', 'routine', 'pwa'];
  const routeFileNeeded = knownRouteNames.some(n => tabId.startsWith(n) || n.startsWith(tabId));
  // More precise check: does dashboard-routes.js reference this tab's route?
  const routeRefInMain = routeRegJs.includes(tabId + '-routes') || routeRegJs.includes(tabId + 'Routes') || routeRegJs.includes(tabId.replace(/-/g, '') + 'Routes');

  // Alias check
  const conflicts = [];
  (t.aliases || []).forEach(a => {
    if (aliasMap[a] && aliasMap[a].length > 1) {
      conflicts.push(a + '→' + aliasMap[a].filter(id => id !== t.id).join(','));
    }
    if (publicTabs.some(other => other.id === a && other.id !== t.id)) {
      conflicts.push(a + '=tab');
    }
  });

  // Output
  const sidestr = hasSidebar ? 'OK' : 'MISS';
  const hrefstr = hrefMatch ? 'OK' : (hasSidebar ? 'MISMATCH' : 'N/A');
  const renstr = hasRenderer ? 'OK' : 'MISS';
  const uiregStr = uiRegistered ? 'OK' : 'MISS';
  const scriptStr = hasStandaloneScript ? 'LOADED' : (inUiJs ? '(ui.js)' : 'MISS');
  const apiStr = routeRefInMain ? 'OK' : (routeFileNeeded && hasRouteFile ? 'FILE-OK' : (routeFileNeeded ? 'MISS' : 'N/A'));
  const aliasStr = conflicts.length ? conflicts.join(';') : 'OK';

  console.log(tabId.padEnd(30) + sidestr.padEnd(8) + hrefstr.padEnd(7) + renstr.padEnd(10) + scriptStr.padEnd(9) + uiregStr.padEnd(9) + apiStr.padEnd(9) + aliasStr);

  // Assertions
  assert(hasSidebar, `${tabId}: has sidebar entry`);
  assert(hrefMatch, `${tabId}: href matches data-tab`);
  assert(hasRenderer, `${tabId}: renderer ${renderer} exists`);
  assert(uiRegistered, `${tabId}: UI.${renderer} registered`);
  if (conflicts.length) {
    warn++;
    console.warn(`  WARN: ${tabId} alias conflict: ${conflicts.join(', ')}`);
  }
});

// Duplicate detection
const dtSeen = {};
sidebarDataTabs.forEach(s => {
  if (dtSeen[s.dataTab]) { assert(false, `Duplicate data-tab: ${s.dataTab}`); }
  dtSeen[s.dataTab] = true;
});
const hrefSeen = {};
sidebarDataTabs.forEach(s => {
  if (s.href && hrefSeen[s.href]) { assert(false, `Duplicate href: #${s.href}`); }
  if (s.href) hrefSeen[s.href] = true;
});

// All public tabs in sidebar
publicTabs.forEach(t => assert(dtSeen[t.id], `${t.id}: has sidebar nav-item`));

// Sidebar items match state.js tabs
sidebarDataTabs.forEach(s => assert(tabs.some(t => t.id === s.dataTab), `Sidebar data-tab="${s.dataTab}" has no state.js entry`));

// UI object checks
assert(uiJs.includes('renderOverview:') || uiJs.includes('renderOverview(') || uiJs.includes('renderOverview ='), 'renderOverview in UI');
assert(uiJs.includes('renderLoading:') || uiJs.includes('renderLoading(') || uiJs.includes('renderLoading ='), 'UI.renderLoading exists');
assert(uiJs.includes('renderError:') || uiJs.includes('renderError(') || uiJs.includes('renderError ='), 'UI.renderError exists');

// app.js routing
assert(appJs.includes('UI[rendererName]'), 'app.js dispatches via UI[rendererName]');
assert(appJs.includes('renderRoutePlaceholder'), 'app.js has placeholder fallback');
assert(appJs.includes('renderRouteError'), 'app.js has error fallback');

// SW check: isSensitiveRequest must exclude /api/dashboard from caching
assert(swJs.includes("pathname.startsWith('/api/dashboard')"), 'SW excludes /api/dashboard from cache');

// Script order check
const appIdx = scriptsLoaded.indexOf('app.js');
const stateIdx = scriptsLoaded.indexOf('state.js');
if (appIdx >= 0 && stateIdx >= 0) {
  assert(stateIdx < appIdx, 'state.js loaded before app.js');
}

// Check isolated standalone renderers register on window.UI
standaloneFiles.forEach(f => {
  const c = standaloneContents[f] || '';
  if (c && !c.includes('window.UI') && !c.includes('UI.render')) {
    // Check if this file defines renderers that need to be on UI
    const hasRenderFn = c.match(/render\w+\s*[:=]\s*(?:function|\()/);
    if (hasRenderFn) {
      assert(c.includes('window.UI'), `${f}: render function must register on window.UI`);
    }
  }
});

console.log(`\n=== BROKEN MENU MATRIX SUMMARY ===`);
console.log(`${pass} passed, ${fail} failed, ${warn} warnings`);
process.exit(fail > 0 ? 1 : 0);
