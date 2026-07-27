'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

function _getContractPath(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const candidates = [
    path.join(repoRoot, 'docs', 'INTEGRATION_CONTRACT.md'),
    path.join(repoRoot, 'INTEGRATION_CONTRACT.md')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function validateIntegrationContract(services) {
  const violations = [];
  const repoRoot = services?.repoRoot || process.cwd();

  const dashStateJs = path.join(repoRoot, 'public', 'dashboard', 'state.js');
  const dashUiJs = path.join(repoRoot, 'public', 'dashboard', 'ui.js');
  const dashRoutesJs = path.join(repoRoot, 'src', 'dashboard', 'dashboard-routes.js');

  const tabViolations = validateDashboardContract(repoRoot, dashStateJs, dashUiJs, dashRoutesJs);
  violations.push(...tabViolations);

  const routeViolations = validateBackendRouteContract(dashRoutesJs);
  violations.push(...routeViolations);

  const moduleViolations = validateModuleUsageContract(repoRoot);
  violations.push(...moduleViolations);

  const report = {
    ok: violations.length === 0,
    violations,
    total: violations.length,
    critical: violations.filter(v => v.severity === 'critical'),
    warnings: violations.filter(v => v.severity === 'warning'),
    timestamp: utils.now()
  };

  store.setIntegrationContract(report, services);
  return report;
}

function validateDashboardContract(repoRoot, stateJs, uiJs, routesJs) {
  const violations = [];
  if (!fs.existsSync(stateJs)) {
    violations.push({ type: 'missing_file', file: 'public/dashboard/state.js', severity: 'critical', message: 'Dashboard state.js not found' });
    return violations;
  }

  const stateContent = fs.readFileSync(stateJs, 'utf8');
  const knownTabs = ['overview', 'ops', 'workspaces', 'users', 'permissions', 'memory', 'goals', 'workflows', 'planner', 'executor', 'agents', 'tools', 'integrations', 'backup', 'insights', 'graph', 'benchmarks', 'incidents', 'audit', 'commands', 'env', 'settings', 'agent-evaluation', 'coding', 'release', 'routines', 'selfhealing', 'monitoring', 'cicd'];

  for (const tab of knownTabs) {
    if (!stateContent.includes(`'${tab}'`) && !stateContent.includes(`"${tab}"`)) {
      violations.push({ type: 'missing_tab', tab, severity: 'warning', message: `Tab "${tab}" not found in state.js registry` });
    }
  }

  if (fs.existsSync(routesJs)) {
    const routesContent = fs.readFileSync(routesJs, 'utf8');
    const routeTabs = knownTabs.filter(t => routesContent.includes(`/${t}`) || routesContent.includes(`'${t}'`));
  }

  return violations;
}

function validateBackendRouteContract(routesJs) {
  const violations = [];
  if (!fs.existsSync(routesJs)) return violations;

  const content = fs.readFileSync(routesJs, 'utf8');
  const routePatterns = [
    { pattern: /router\.(get|post|put|delete)\(/, severity: 'warning', message: 'Routes should have auth protection' }
  ];

  if (!content.includes('dashboardAuth') && !content.includes('auth.createDashboardAuth')) {
    violations.push({ type: 'missing_auth', severity: 'critical', message: 'No dashboard auth middleware found in dashboard-routes.js' });
  }

  return violations;
}

function validateModuleUsageContract(repoRoot) {
  const violations = [];
  const srcDir = path.join(repoRoot, 'src');
  if (!fs.existsSync(srcDir)) return violations;

  const moduleDirs = fs.readdirSync(srcDir, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dir of moduleDirs) {
    const dirPath = path.join(srcDir, dir.name);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('module.exports') && !content.includes('exports.')) {
        violations.push({ type: 'no_exports', file: `src/${dir.name}/${file}`, severity: 'warning', message: 'Module has no exports' });
      }
    }
  }

  return violations;
}

function buildContractViolationReport(results) {
  return {
    ok: results.ok,
    summary: {
      totalViolations: results.total,
      critical: results.critical.length,
      warnings: results.warnings.length,
      passed: results.ok
    },
    violations: results.violations
  };
}

module.exports = {
  validateIntegrationContract,
  validateDashboardContract,
  validateBackendRouteContract,
  validateModuleUsageContract,
  buildContractViolationReport
};
