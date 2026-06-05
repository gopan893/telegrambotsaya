'use strict';

const fs = require('fs');
const path = require('path');
const store = require('./devgovernance-store');
const contractManager = require('./agent-contract-manager');
const collDetector = require('./collision-detector');

function runGoveranceChecks(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const checks = [];

  const contractExists = fs.existsSync(path.join(repoRoot, 'AGENTS.md'));
  checks.push({ name: 'AGENTS.md exists', passed: contractExists, critical: true });
  if (!contractExists && fs.existsSync(path.join(repoRoot, 'docs', 'AGENTS.md'))) {
    checks.push({ name: 'docs/AGENTS.md exists (alternative location)', passed: true, critical: true });
  }

  const handoffExists = fs.existsSync(path.join(repoRoot, 'AGENT_HANDOFF.md'));
  checks.push({ name: 'AGENT_HANDOFF.md exists', passed: handoffExists, critical: true });
  if (!handoffExists && fs.existsSync(path.join(repoRoot, 'docs', 'AGENT_HANDOFF.md'))) {
    checks.push({ name: 'docs/AGENT_HANDOFF.md exists (alternative)', passed: true, critical: true });
  }

  const archMapExists = fs.existsSync(path.join(repoRoot, 'docs', 'ARCHITECTURE_MAP.md'));
  checks.push({ name: 'ARCHITECTURE_MAP.md exists', passed: archMapExists, critical: false });

  const contractVal = contractManager.validateAgentContract(services);
  checks.push({ name: 'Agent contract valid', passed: contractVal.ok, critical: true, details: contractVal.errors });

  const coll = collDetector.detectCollisions(services);
  checks.push({ name: 'No critical module collisions', passed: coll.critical.length === 0, critical: true, details: coll.critical.map(c => c.message) });
  checks.push({ name: 'No module warnings', passed: coll.warnings.length === 0, critical: false, details: coll.warnings.length > 0 ? `${coll.warnings.length} warnings` : undefined });

  const stateJs = path.join(repoRoot, 'public', 'dashboard', 'state.js');
  const hasDevGovernanceTab = fs.existsSync(stateJs) && fs.readFileSync(stateJs, 'utf8').includes('devgovernance');
  checks.push({ name: 'DevGovernance tab in dashboard', passed: hasDevGovernanceTab, critical: false });

  const overallPassed = checks.filter(c => c.critical).every(c => c.passed);
  const result = { ok: overallPassed, checks, criticalPassed: checks.filter(c => c.critical).every(c => c.passed), totalChecks: checks.length, passedChecks: checks.filter(c => c.passed).length, timestamp: new Date().toISOString() };
  return result;
}

module.exports = { runGoveranceChecks };
