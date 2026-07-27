'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

const KNOWN_COMMANDS = [
  '/start', '/help', '/dashboard', '/dbstatus', '/redisstatus',
  '/audit', '/whoami', '/ping', '/reset', '/stats',
  '/devgov', '/handoff', '/handoff_update', '/archmap',
  '/contractcheck', '/collisioncheck', '/dashboardroutes',
  '/nextcodex', '/nextopencode', '/p0prompt'
];

function buildCollisionReport(results) {
  return {
    ok: results.critical.length === 0,
    summary: {
      total: results.total,
      critical: results.critical.length,
      warnings: results.warnings.length
    },
    collisions: results.collisions
  };
}

function detectDuplicateModules(services) {
  const collisions = [];
  const repoRoot = services?.repoRoot || process.cwd();
  const srcDir = path.join(repoRoot, 'src');
  if (!fs.existsSync(srcDir)) return { collisions, critical: [], warnings: [], total: 0 };

  const moduleMap = {};
  const dirs = fs.readdirSync(srcDir, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dir of dirs) {
    const dirPath = path.join(srcDir, dir.name);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const baseName = file.replace(/\.js$/, '');
      if (!moduleMap[baseName]) moduleMap[baseName] = [];
      moduleMap[baseName].push(`src/${dir.name}/${file}`);
    }
  }

  for (const [name, locations] of Object.entries(moduleMap)) {
    if (locations.length > 1) {
      collisions.push({
        type: 'duplicate_module',
        name,
        locations,
        severity: 'warning',
        message: `Module "${name}" found in multiple locations: ${locations.join(', ')}`
      });
    }
  }

  return collisions;
}

function detectConflictingRoutes(services) {
  const collisions = [];
  const repoRoot = services?.repoRoot || process.cwd();
  const routesJs = path.join(repoRoot, 'src', 'dashboard', 'dashboard-routes.js');
  if (!fs.existsSync(routesJs)) return collisions;

  const content = fs.readFileSync(routesJs, 'utf8');
  const routeMatches = content.matchAll(/router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g);
  const routes = {};
  for (const m of routeMatches) {
    const routePath = m[2];
    if (routes[routePath]) {
      routes[routePath].count++;
    } else {
      routes[routePath] = { count: 1, line: '' };
    }
  }

  for (const [route, info] of Object.entries(routes)) {
    if (info.count > 1) {
      collisions.push({
        type: 'duplicate_route',
        route,
        severity: 'critical',
        message: `Route "${route}" registered ${info.count} times`
      });
    }
  }

  return collisions;
}

function detectConflictingDashboardTabs(services) {
  const collisions = [];
  const repoRoot = services?.repoRoot || process.cwd();
  const stateJs = path.join(repoRoot, 'public', 'dashboard', 'state.js');
  const indexHtml = path.join(repoRoot, 'public', 'dashboard', 'index.html');
  const uiJs = path.join(repoRoot, 'public', 'dashboard', 'ui.js');

  if (!fs.existsSync(stateJs)) return collisions;

  const stateContent = fs.readFileSync(stateJs, 'utf8');
  const tabIds = stateContent.match(/['"](\w[\w-]*)['"]\s*:\s*\{/g);

  if (fs.existsSync(indexHtml)) {
    const htmlContent = fs.readFileSync(indexHtml, 'utf8');
    const menuTabs = htmlContent.match(/data-tab="(\w[\w-]*)"/g) || [];
    const menuIds = menuTabs.map(m => m.match(/data-tab="(\w[\w-]*)"/)[1]);
    if (tabIds) {
      for (const tabMatch of tabIds) {
        const tabId = tabMatch.match(/['"](\w[\w-]*)['"]/)[1];
        if (tabId !== 'overview' && !menuIds.includes(tabId)) {
          collisions.push({
            type: 'tab_not_in_menu',
            tab: tabId,
            severity: 'warning',
            message: `Tab "${tabId}" in registry but not in sidebar menu`
          });
        }
      }
    }
  }

  return collisions;
}

function detectUnusedNewFiles(services) {
  const collisions = [];
  const repoRoot = services?.repoRoot || process.cwd();

  try {
    const { execSync } = require('child_process');
    const status = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4096 }).toString();
    const newFiles = status.split('\n')
      .filter(l => l.startsWith('?? '))
      .map(l => l.substring(3).trim())
      .filter(f => f.endsWith('.js') && !f.startsWith('scratch/test-'));

    const existingFiles = [];
    const walkDir = (dir) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walkDir(full);
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            existingFiles.push(full);
          }
        }
      } catch (_) {}
    };
    walkDir(repoRoot);

    for (const nf of newFiles) {
      const absPath = path.join(repoRoot, nf);
      if (!fs.existsSync(absPath)) continue;

      const fileName = path.basename(nf, '.js');
      let used = false;
      for (const ef of existingFiles) {
        if (ef === absPath) continue;
        try {
          const content = fs.readFileSync(ef, 'utf8');
          if (content.includes(fileName) || content.includes(`./${fileName}`) || content.includes(nf)) {
            used = true;
            break;
          }
        } catch (_) {}
      }

      if (!used) {
        collisions.push({
          type: 'unused_new_file',
          file: nf,
          severity: 'warning',
          message: `New file "${nf}" not imported or used in any existing module`
        });
      }
    }
  } catch (_) {}

  return collisions;
}

function detectFrontendBackendMismatch(services) {
  const collisions = [];
  const repoRoot = services?.repoRoot || process.cwd();
  const apiJs = path.join(repoRoot, 'public', 'dashboard', 'api.js');
  const routesJs = path.join(repoRoot, 'src', 'dashboard', 'dashboard-routes.js');

  if (!fs.existsSync(apiJs) || !fs.existsSync(routesJs)) return collisions;

  const apiContent = fs.readFileSync(apiJs, 'utf8');
  const routesContent = fs.readFileSync(routesJs, 'utf8');

  const apiCalls = apiContent.match(/apiGet\(['"`]\/([^'"`]+)['"`]/g) || [];
  for (const call of apiCalls) {
    const endpoint = call.match(/['"`]\/([^'"`]+)['"`]/)[1];
    const routePath = `/${endpoint}`;
    if (!routesContent.includes(routePath) && !routesContent.includes(`'${endpoint}'`) && !routesContent.includes(`"${endpoint}"`)) {
      collisions.push({
        type: 'missing_backend_route',
        route: routePath,
        severity: 'warning',
        message: `Frontend calls "${routePath}" but no backend route found`
      });
    }
  }

  return collisions;
}

function detectCommandCollision(services) {
  const collisions = [];
  const repoRoot = services?.repoRoot || process.cwd();

  const legacyRuntime = path.join(repoRoot, 'src', 'bot', 'legacy-runtime.js');
  if (!fs.existsSync(legacyRuntime)) return collisions;

  const content = fs.readFileSync(legacyRuntime, 'utf8');
  const found = {};
  for (const cmd of KNOWN_COMMANDS) {
    const escaped = cmd.replace(/\//g, '\\/');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'g');
    const matches = content.match(pattern);
    if (matches) {
      found[cmd] = matches.length;
    }
  }

  return collisions;
}

function detectCollisions(services) {
  const allCollisions = [
    ...detectDuplicateModules(services),
    ...detectConflictingRoutes(services),
    ...detectConflictingDashboardTabs(services),
    ...detectUnusedNewFiles(services),
    ...detectFrontendBackendMismatch(services),
    ...detectCommandCollision(services)
  ];

  const critical = allCollisions.filter(c => c.severity === 'critical');
  const warnings = allCollisions.filter(c => c.severity === 'warning');
  const results = { collisions: allCollisions, critical, warnings, total: allCollisions.length };

  store.addCollisionReport(buildCollisionReport(results), services);
  return results;
}

module.exports = {
  detectDuplicateModules,
  detectConflictingRoutes,
  detectConflictingDashboardTabs,
  detectUnusedNewFiles,
  detectFrontendBackendMismatch,
  detectCommandCollision,
  detectCollisions,
  buildCollisionReport
};
