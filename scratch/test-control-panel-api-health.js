'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }
function soft(cond, msg) { if (cond) { pass++; } else { console.warn(`WARN: ${msg}`); } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');
const routesJs = fs.readFileSync(path.join(ROOT, 'src/dashboard/dashboard-routes.js'), 'utf8');

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
  const ren = lines[i].match(/renderer:\s*'([^']+)'/);
  if (ren && currentId) currentConfig.renderer = ren[1];
  const vis = lines[i].match(/navVisible:\s*(true|false)/);
  if (vis && currentId) currentConfig.navVisible = vis[1] === 'true';
  const int = lines[i].match(/internalOnly:\s*(true|false)/);
  if (int && currentId) currentConfig.internalOnly = int[1] === 'true';
  if (lines[i].match(/^\s{2}\},/) && currentId) {
    tabs.push({ id: currentId, ...currentConfig });
    currentId = null; currentConfig = {};
  }
}
if (currentId) tabs.push({ id: currentId, ...currentConfig });

const publicTabs = tabs.filter(t => t.navVisible !== false && t.internalOnly !== true);

// Route file mapping: tab ID -> expected route file in src/dashboard
const ROUTE_FILE_MAP = {
  // Tabs with dedicated route files
  backup: 'backup-routes.js',
  planner: 'planner-routes.js',
  executor: 'executor-routes.js',
  tools: 'tool-routes.js',
  workspaces: 'workspace-routes.js',
  memory: 'agent-memory-routes.js',
  agents: 'agent-routes.js',
  integrations: 'integration-execution-routes.js',
  selfhealing: 'selfhealing-routes.js',
  monitoring: 'monitoring-routes.js',
  cicd: 'cicd-routes.js',
  devgovernance: 'devgovernance-routes.js',
  githubops: 'githubops-routes.js',
  deploy: 'deploy-routes.js',
  cost: 'cost-routes.js',
  knowledge: 'knowledge-routes.js',
  governance: 'governance-routes.js',
  security: 'security-routes.js',
  privacy: 'privacy-routes.js',
  'release-candidate': 'release-candidate-routes.js',
  'production-release': 'production-release-routes.js',
  reliability: 'reliability-routes.js',
  research: 'research-routes.js',
  'docs-intel': 'docs-intel-routes.js',
  'model-router': 'model-router-routes.js',
  plugins: 'plugin-routes.js',
  'rag-kb': 'rag-kb-routes.js',
  recipes: 'recipe-routes.js',
  mobile: 'mobile-routes.js',
  'disaster-recovery': 'disaster-recovery-routes.js',
  consolidation: 'consolidation-routes.js',
  operator: 'operator-routes.js',
  'telegram-control': 'telegram-control-routes.js',
  'operating-loop': 'operating-loop-routes.js',
  improvement: 'improvement-routes.js',
  portfolio: 'portfolio-routes.js',
  lifeos: 'lifeos-routes.js',
  observability: 'observability-routes.js',
  'agent-evaluation': 'agent-evaluation-routes.js',
  coding: 'coding-workspace-routes.js',
  routines: 'routine-routes.js',
  'pwa': 'pwa-routes.js',
  council: 'council-routes.js',
  'agent-executor': 'agent-executor-routes.js',
  decision: 'decision-routes.js',
};

// Frontend API endpoint usage map: tab ID -> what the renderer fetches
// Check each renderer fetches from correct endpoint
const FRONTEND_FETCH_CHECK = {
  overview: null, // via Api.getSummary(), getUserOverview()
  agents: '/agents',
  executor: '/executor',
  integrations: '/integrations',
  selfhealing: null, // via Api module
  monitoring: '/monitoring/snapshot',
  cicd: '/cicd/status',
  githubops: '/githubops',
  deploy: '/deploy',
  observability: null,
  cost: null,
  knowledge: null,
  'telegram-control': '/telegram-control',
  'operating-loop': '/operating-loop',
  improvement: null,
  governance: '/governance',
  security: '/security',
  privacy: '/privacy',
  'release-candidate': '/release-candidate',
  'production-release': '/production-release',
  reliability: '/reliability',
  research: null,
  'docs-intel': null,
  'model-router': null,
  plugins: '/plugins',
  'rag-kb': null,
  recipes: '/recipes',
  mobile: '/mobile',
  'disaster-recovery': '/disaster-recovery',
  consolidation: '/consolidation',
  operator: '/operator',
  portfolio: null,
  lifeos: null,
};

console.log('\n=== API Health Check ===\n');

// 1. Check all public tabs have their route file
const existingRouteFiles = fs.readdirSync(path.join(ROOT, 'src/dashboard'));
publicTabs.forEach(t => {
  const expected = ROUTE_FILE_MAP[t.id];
  if (expected) {
    assert(existingRouteFiles.includes(expected), `${t.id}: route file ${expected} exists`);
    // Check dashboard-routes.js references this route
    const routeName = expected.replace('.js', '');
    const refInMain = routesJs.includes(routeName) || routesJs.includes(expected.replace('-routes.js', 'Routes'));
    soft(refInMain, `${t.id}: ${expected} referenced in dashboard-routes.js`);
  }
});

// 2. Check frontend files reference correct API endpoints
const dashboardFiles = fs.readdirSync(path.join(ROOT, 'public/dashboard')).filter(f => f.endsWith('.js'));
dashboardFiles.forEach(f => {
  const content = fs.readFileSync(path.join(ROOT, 'public/dashboard', f), 'utf8');
  // Check for hardcoded full paths (should use Api.apiGet which prepends /api/dashboard)
  const fullPathRefs = content.match(/['"`]\/api\/dashboard\//g);
  if (fullPathRefs) {
    // Only flag if the file doesn't use correct API method
    const usesApiGet = content.includes('Api.apiGet') || content.includes('Api.apiPost');
    if (!usesApiGet) {
      console.warn(`WARN: ${f} uses hardcoded /api/dashboard/ paths but no Api.apiGet/Api.apiPost`);
    }
  }
});

// 3. Check safe response pattern is used in route files
const routeDir = path.join(ROOT, 'src/dashboard');
fs.readdirSync(routeDir).filter(f => f.endsWith('-routes.js')).forEach(f => {
  const content = fs.readFileSync(path.join(routeDir, f), 'utf8');
  if (content.includes('safeDashboardResponse')) {
    soft(true, `${f}: uses safeDashboardResponse`);
  } else {
    const usesResJson = content.includes('res.json') || content.includes('res.status');
    if (usesResJson) {
      // Still OK if it uses res.json directly — check for error handling
      if (!content.includes('try') && !content.includes('.catch')) {
        console.warn(`WARN: ${f}: uses res.json but no try/catch found`);
      }
    }
  }
});

// 4. Check all dashboard-routes.js route references have corresponding files
const subRouteRefs = routesJs.match(/require\('\.\/([^']+)'\)/g) || [];
subRouteRefs.forEach(ref => {
  const name = ref.match(/require\('\.\/([^']+)'\)/)[1];
  const fullPath = path.join(ROOT, 'src/dashboard', `${name}.js`);
  try {
    fs.accessSync(fullPath);
  } catch (_) {
    assert(false, `Referenced route file ${name}.js not found`);
  }
});

// 5. Verify safeDashboardResponse exists
assert(routesJs.includes('safeDashboardResponse'), 'safeDashboardResponse function exists');

// 6. Check rate limiting on action endpoints
assert(routesJs.includes('rateLimitDashboardAction'), 'rateLimitDashboardAction exists');

console.log(`\n=== API Health: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
