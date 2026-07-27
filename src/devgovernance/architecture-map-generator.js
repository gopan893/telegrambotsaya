'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

const KNOWN_DASHBOARD_TABS = [
  'overview', 'ops', 'workspaces', 'users', 'permissions',
  'memory', 'goals', 'workflows', 'planner', 'executor',
  'agents', 'tools', 'integrations', 'backup', 'insights',
  'graph', 'benchmarks', 'incidents', 'audit', 'commands',
  'env', 'settings', 'agent-evaluation', 'coding', 'release',
  'routines', 'selfhealing', 'monitoring', 'cicd', 'devgovernance'
];

const KNOWN_TELEGRAM_COMMANDS = [
  '/start', '/help', '/dashboard', '/dbstatus', '/redisstatus',
  '/audit', '/whoami', '/workspace', '/workspaces', '/ping',
  '/reset', '/stats', '/hitung', '/jam', '/tanggal', '/cuaca',
  '/cari', '/mode', '/adaptive', '/aios', '/remember', '/memory',
  '/forget', '/goals', '/goaladd', '/goalupdate', '/workflows',
  '/workflowadd', '/workflowstep', '/workflowdone', '/insights',
  '/plans', '/plan', '/planadd', '/plantasks', '/taskadd',
  '/taskdone', '/taskblock', '/next', '/priorities',
  '/executions', '/pending', '/propose', '/propose_action',
  '/actionplans', '/approve', '/reject', '/runexec', '/schedule',
  '/execresult', '/tools', '/backup', '/backuplist', '/restore',
  '/export', '/import', '/multibot', '/agent', '/agents',
  '/eval', '/evaluate', '/council', '/decide', '/delegate',
  '/devgov', '/handoff', '/handoff_update', '/archmap',
  '/contractcheck', '/collisioncheck', '/dashboardroutes',
  '/nextcodex', '/nextopencode', '/p0prompt'
];

function _getArchMapPath(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const candidates = [
    path.join(repoRoot, 'docs', 'ARCHITECTURE_MAP.md'),
    path.join(repoRoot, 'ARCHITECTURE_MAP.md')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function scanArchitecture(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const warnings = [];
  const data = {
    entryPoints: detectEntryPoints(repoRoot, services),
    dashboardTabs: detectDashboardTabs(repoRoot, services),
    dashboardRoutes: detectDashboardRoutes(repoRoot, services),
    telegramCommands: detectTelegramCommands(repoRoot, services),
    moduleGroups: detectModuleGroups(repoRoot, services),
    testFiles: [],
    docs: [],
    warnings
  };

  const srcDir = path.join(repoRoot, 'src');
  if (fs.existsSync(srcDir)) {
    try {
      data.docs = fs.readdirSync(path.join(repoRoot, 'docs')).filter(f => f.endsWith('.md'));
    } catch (_) { warnings.push('Could not read docs/'); }
    try {
      data.testFiles = fs.readdirSync(path.join(repoRoot, 'scratch')).filter(f => f.endsWith('.js'));
    } catch (_) { warnings.push('Could not read scratch/'); }
  }

  return data;
}

function detectEntryPoints(repoRoot, services) {
  const entries = [];
  const candidates = {
    'telebot.js': 'Production entry',
    'start-local.js': 'Dev entry'
  };
  for (const [file, role] of Object.entries(candidates)) {
    if (fs.existsSync(path.join(repoRoot, file))) {
      entries.push({ file, role });
    }
  }
  return entries;
}

function detectDashboardTabs(repoRoot, services) {
  const tabs = [];
  const stateJs = path.join(repoRoot, 'public', 'dashboard', 'state.js');
  if (fs.existsSync(stateJs)) {
    const content = fs.readFileSync(stateJs, 'utf8');
    for (const tab of KNOWN_DASHBOARD_TABS) {
      if (content.includes(`'${tab}'`) || content.includes(`"${tab}"`)) {
        tabs.push({ id: tab, found: true });
      } else {
        tabs.push({ id: tab, found: false });
      }
    }
  }
  return tabs;
}

function detectDashboardRoutes(repoRoot, services) {
  const routes = [];
  const dashRoutesJs = path.join(repoRoot, 'src', 'dashboard', 'dashboard-routes.js');
  if (fs.existsSync(dashRoutesJs)) {
    const content = fs.readFileSync(dashRoutesJs, 'utf8');
    const routeMatches = content.match(/router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g) || [];
    for (const m of routeMatches) {
      const parts = m.match(/['"`]([^'"`]+)['"`]/);
      if (parts) routes.push(parts[1]);
    }
  }
  return routes;
}

function detectTelegramCommands(repoRoot, services) {
  const cmds = [];
  for (const cmd of KNOWN_TELEGRAM_COMMANDS) {
    cmds.push({ command: cmd, known: true });
  }
  return cmds;
}

function detectModuleGroups(repoRoot, services) {
  const srcDir = path.join(repoRoot, 'src');
  const groups = {};
  if (fs.existsSync(srcDir)) {
    try {
      const dirs = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const files = fs.readdirSync(path.join(srcDir, d.name)).filter(f => f.endsWith('.js'));
          groups[d.name] = files;
        }
      }
    } catch (_) {}
  }
  return groups;
}

function writeArchitectureMap(scan, services) {
  const lines = [];
  lines.push('# ARCHITECTURE_MAP.md');
  lines.push('');

  lines.push('## Entry Points');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|---|---|');
  for (const e of scan.entryPoints) {
    lines.push(`| \`${e.file}\` | ${e.role} |`);
  }
  lines.push('');

  lines.push('## Dashboard Tabs');
  lines.push('');
  lines.push('| Tab ID | Found in state.js |');
  lines.push('|---|---|');
  for (const t of scan.dashboardTabs) {
    lines.push(`| \`${t.id}\` | ${t.found ? '✅' : '❌'} |`);
  }
  lines.push('');

  lines.push('## Backend Dashboard Routes');
  lines.push('');
  for (const r of scan.dashboardRoutes) {
    lines.push(`- \`${r}\``);
  }
  lines.push('');

  lines.push('## Telegram Commands');
  lines.push('');
  lines.push(`Total known commands: ${scan.telegramCommands.length}`);
  lines.push('');

  lines.push('## Module Groups');
  lines.push('');
  for (const [group, files] of Object.entries(scan.moduleGroups)) {
    lines.push(`### ${group}/`);
    lines.push('');
    for (const f of files) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  lines.push('## Documentation Files');
  lines.push('');
  for (const d of scan.docs) {
    lines.push(`- \`${d}\``);
  }
  lines.push('');

  lines.push('## Test Files');
  lines.push('');
  for (const t of scan.testFiles) {
    lines.push(`- \`${t}\``);
  }
  lines.push('');

  if (scan.warnings.length) {
    lines.push('## Warnings');
    for (const w of scan.warnings) {
      lines.push(`- ⚠️ ${w}`);
    }
    lines.push('');
  }

  const content = lines.join('\n');
  const fp = _getArchMapPath(services);
  fs.writeFileSync(fp, content, 'utf8');
  store.setArchitectureMap(scan, services);
  return { ok: true, path: fp, content };
}

function generateArchitectureMap(services) {
  const scan = scanArchitecture(services);
  return writeArchitectureMap(scan, services);
}

function getArchitectureMapStatus(services) {
  const scan = scanArchitecture(services);
  return {
    ok: true,
    entryPoints: scan.entryPoints.length,
    dashboardTabs: { total: scan.dashboardTabs.length, found: scan.dashboardTabs.filter(t => t.found).length },
    dashboardRoutes: scan.dashboardRoutes.length,
    telegramCommands: scan.telegramCommands.length,
    moduleGroups: Object.keys(scan.moduleGroups).length,
    warnings: scan.warnings
  };
}

module.exports = {
  scanArchitecture,
  detectEntryPoints,
  detectDashboardTabs,
  detectDashboardRoutes,
  detectTelegramCommands,
  detectModuleGroups,
  writeArchitectureMap,
  generateArchitectureMap,
  getArchitectureMapStatus
};
