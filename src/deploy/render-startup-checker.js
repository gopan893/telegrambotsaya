'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./deploy-utils');
const store = require('./deploy-release-store');

function _tryNodeCheck(filePath) {
  try {
    const { execSync } = require('child_process');
    execSync(`node --check "${filePath}"`, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString()?.slice(0, 500) || e.message };
  }
}

function runStartupSyntaxCheck(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const entry = path.join(repoRoot, 'telebot.js');

  if (!fs.existsSync(entry)) {
    return { ok: false, error: 'telebot.js not found', manualRequired: true };
  }

  const result = _tryNodeCheck(entry);
  return {
    ok: result.ok,
    syntaxValid: result.ok,
    checkedFile: 'telebot.js',
    error: result.error || null,
    timestamp: utils.now()
  };
}

function runStartupSmokePlan(services) {
  return {
    ok: true,
    plan: [
      '1. Run: node --check telebot.js',
      '2. Set env: TELEGRAM_TOKEN, DASHBOARD_ADMIN_TOKEN, PORT',
      '3. Run: npm start',
      '4. Verify: Server berjalan di port <PORT>',
      '5. Test: curl http://localhost:<PORT>/api/dashboard/health',
      '',
      'If steps fail, check Render logs for specific error.'
    ].join('\n'),
    timestamp: utils.now()
  };
}

function detectMissingDependencies(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const pkgPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: 'package.json not found' };
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    return { ok: false, error: 'package.json parse error: ' + e.message };
  }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const missing = [];

  for (const [name] of Object.entries(deps)) {
    try {
      require.resolve(name, { paths: [repoRoot] });
    } catch (_) {
      missing.push(name);
    }
  }

  return {
    ok: missing.length === 0,
    missingDeps: missing,
    totalDeps: Object.keys(deps).length,
    summary: missing.length === 0 ? 'All dependencies found' : `Missing: ${missing.join(', ')}`,
    timestamp: utils.now()
  };
}

function detectCommonJsEsmMismatch(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const issues = [];

  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.type === 'module') {
        issues.push('package.json has "type": "module" but codebase uses CommonJS (require/module.exports)');
      }
    } catch (_) {}
  }

  return { ok: issues.length === 0, issues, timestamp: utils.now() };
}

function detectBrokenExports(services) {
  return { ok: true, note: 'Full export check requires runtime load', timestamp: utils.now() };
}

function buildStartupCheckReport(services) {
  const checks = {
    syntaxCheck: runStartupSyntaxCheck(services),
    missingDeps: detectMissingDependencies(services),
    esmMismatch: detectCommonJsEsmMismatch(services)
  };

  const allOk = Object.values(checks).every(c => c.ok !== false);

  const report = {
    ok: allOk,
    checks,
    summary: allOk ? 'Startup checks passed' : 'Some startup checks failed',
    timestamp: utils.now()
  };

  store.addDeployGate(report);
  return report;
}

module.exports = {
  runStartupSyntaxCheck,
  runStartupSmokePlan,
  detectMissingDependencies,
  detectCommonJsEsmMismatch,
  detectBrokenExports,
  buildStartupCheckReport
};
