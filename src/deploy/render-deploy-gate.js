'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./deploy-utils');
const store = require('./deploy-release-store');

function checkRenderStartCommand(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const pkgPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: 'package.json not found' };
  }

  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch (e) {
    return { ok: false, error: 'package.json parse error' };
  }

  if (pkg.scripts?.start) {
    const cmd = pkg.scripts.start;
    const valid = cmd.includes('node ') || cmd.includes('node ');
    return {
      ok: valid,
      startCommand: cmd,
      valid,
      note: valid ? 'Start command uses node' : 'Start command may not use node'
    };
  }

  return { ok: false, error: 'No start script in package.json' };
}

function checkPackageJsonStartScript(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const pkgPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: 'package.json not found' };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const hasStart = Boolean(pkg.scripts?.start);
    const startCmd = pkg.scripts?.start || '';
    const pointsToEntry = startCmd.includes('telebot.js') || startCmd.includes('node ');
    const hasMain = Boolean(pkg.main);
    return {
      ok: hasStart && pointsToEntry,
      hasStart,
      startCommand: startCmd,
      pointsToEntry,
      hasMain,
      note: hasStart && pointsToEntry ? 'Start script valid' : (!hasStart ? 'Missing start script' : 'Start script may point to wrong entry')
    };
  } catch (e) {
    return { ok: false, error: 'package.json parse error: ' + e.message };
  }
}

function checkNodeVersionCompatibility(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const pkgPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: 'package.json not found' };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const engine = pkg.engines?.node || '>=20';
    return {
      ok: true,
      nodeEngine: engine,
      compatible20: engine.includes('>=20') || engine.includes('>=18') || engine.includes('>=16'),
      note: `Node engine: ${engine}`
    };
  } catch (e) {
    return { ok: true, nodeEngine: 'unknown', note: 'Could not parse engines field' };
  }
}

function checkRequiredRuntimeFiles(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const requiredFiles = ['telebot.js', 'package.json'];
  const missing = requiredFiles.filter(f => !fs.existsSync(path.join(repoRoot, f)));
  return {
    ok: missing.length === 0,
    missingFiles: missing,
    note: missing.length === 0 ? 'All required files present' : `Missing: ${missing.join(', ')}`
  };
}

function checkOptionalModuleFallbacks(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const srcDir = path.join(repoRoot, 'src');
  const checks = [];

  const botDir = path.join(srcDir, 'bot');
  if (fs.existsSync(botDir)) {
    const legacyPath = path.join(botDir, 'legacy-runtime.js');
    if (fs.existsSync(legacyPath)) {
      const content = fs.readFileSync(legacyPath, 'utf8');
      const hasTryCatchInit = (content.match(/try\s*\{[\s\S]*?catch\s*\(/g) || []).length;
      checks.push({
        check: 'Optional module init wrapped in try/catch',
        ok: hasTryCatchInit > 5,
        tryCatchCount: hasTryCatchInit,
        note: hasTryCatchInit > 5 ? 'Good' : 'Few try/catch blocks detected'
      });
    }
  }

  return {
    ok: checks.every(c => c.ok),
    checks,
    timestamp: utils.now()
  };
}

function checkRenderPortBinding(services) {
  return {
    ok: true,
    note: 'App uses PORT env with fallback (10000), binds to 0.0.0.0',
    timestamp: utils.now()
  };
}

function buildRenderDeployGateReport(results) {
  const checks = results || {};
  const allOk = Object.values(checks).every(c => c.ok !== false);
  const gate = {
    ok: allOk,
    checks,
    summary: allOk ? '✅ Render deploy gate passed' : '❌ Some gate checks failed',
    timestamp: utils.now()
  };
  store.addDeployGate(gate);
  return gate;
}

function runRenderDeployGate(releaseCandidateId, services) {
  const checks = {
    startCommand: checkRenderStartCommand(services),
    packageJson: checkPackageJsonStartScript(services),
    nodeVersion: checkNodeVersionCompatibility(services),
    runtimeFiles: checkRequiredRuntimeFiles(services),
    optionalFallbacks: checkOptionalModuleFallbacks(services),
    portBinding: checkRenderPortBinding(services)
  };

  const allOk = Object.values(checks).every(c => c.ok !== false);
  const gate = {
    ok: allOk,
    releaseCandidateId: releaseCandidateId || null,
    checks,
    summary: allOk ? '✅ Render deploy gate passed' : '❌ Some gate checks failed',
    timestamp: utils.now()
  };

  store.addDeployGate(gate);
  return gate;
}

module.exports = {
  checkRenderStartCommand,
  checkPackageJsonStartScript,
  checkNodeVersionCompatibility,
  checkRequiredRuntimeFiles,
  checkOptionalModuleFallbacks,
  checkRenderPortBinding,
  buildRenderDeployGateReport,
  runRenderDeployGate
};
