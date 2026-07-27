'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

const REQUIRED_DOCS = [
  'README.md',
  'AGENTS.md',
  'docs/COMMANDS.md',
  'docs/TESTING.md',
  'docs/ARCHITECTURE_MAP.md',
  'docs/INTEGRATION_CONTRACT.md',
  'docs/AGENT_HANDOFF.md'
];

async function auditDocsConsistency(services = {}) {
  const docs = {};
  for (const doc of REQUIRED_DOCS) {
    const fullPath = path.join(BASE, doc);
    try {
      const stat = fs.statSync(fullPath);
      docs[doc] = { exists: true, size: stat.size };
    } catch (_) {
      docs[doc] = { exists: false, size: 0 };
    }
  }
  return docs;
}

async function detectMissingModuleDocs(services = {}) {
  const archMapPath = path.join(BASE, 'docs', 'ARCHITECTURE_MAP.md');
  try {
    const content = fs.readFileSync(archMapPath, 'utf8');
    const moduleMatches = content.matchAll(/`src\/([^`]+)`/g);
    const modules = new Set();
    for (const m of moduleMatches) {
      modules.add(m[1].split('/')[0]);
    }
    const missing = [];
    for (const mod of modules) {
      const docPath = path.join(BASE, 'docs', `${mod.toUpperCase()}.md`);
      if (!fs.existsSync(docPath)) {
        const altPath = path.join(BASE, 'docs', `${mod}.md`);
        if (!fs.existsSync(altPath)) {
          missing.push({ module: mod, issue: 'No matching docs file' });
        }
      }
    }
    return missing;
  } catch (_) {
    return [];
  }
}

async function detectOutdatedCommandDocs(services = {}) {
  const cmdDocPath = path.join(BASE, 'docs', 'COMMANDS.md');
  const cmdRegPath = path.join(BASE, 'src', 'telegram-control', 'telegram-command-registry.js');
  try {
    const cmdDoc = fs.readFileSync(cmdDocPath, 'utf8');
    const cmdReg = fs.readFileSync(cmdRegPath, 'utf8');
    const regCommands = new Set();
    const cmdMatches = cmdReg.matchAll(/name:\s*['"`]([^'"`]+)['"`]/g);
    for (const m of cmdMatches) regCommands.add(m[1]);

    const docCommands = new Set();
    const docMatches = cmdDoc.matchAll(/`\/(\w+)`/g);
    for (const m of docMatches) docCommands.add(m[1]);

    const missing = [];
    for (const cmd of regCommands) {
      if (!docCommands.has(cmd)) {
        missing.push({ command: cmd, issue: 'Command not documented in COMMANDS.md' });
      }
    }
    return missing;
  } catch (_) {
    return [];
  }
}

async function detectOutdatedEnvDocs(services = {}) {
  const envFiles = ['.env.example', 'docs/DEPLOY.md', 'docs/FINAL_ENVIRONMENT_CHECKLIST.md'];
  const outdated = [];
  for (const file of envFiles) {
    const fullPath = path.join(BASE, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('[TODO]') || content.includes('TODO') && content.length < 100) {
        outdated.push({ file, issue: 'Env docs appear incomplete or contain TODOs' });
      }
    } catch (_) {
      outdated.push({ file, issue: 'Env doc file not found' });
    }
  }
  return outdated;
}

async function detectOutdatedArchitectureDocs(services = {}) {
  const archPath = path.join(BASE, 'docs', 'ARCHITECTURE_MAP.md');
  const srcDirs = utils.getSrcDirectories(BASE);
  try {
    const content = fs.readFileSync(archPath, 'utf8');
    const outdated = [];
    for (const dir of srcDirs) {
      if (!content.includes(dir)) {
        outdated.push({ module: dir, issue: 'Module not documented in ARCHITECTURE_MAP.md' });
      }
    }
    return outdated;
  } catch (_) {
    return srcDirs.map(d => ({ module: d, issue: 'ARCHITECTURE_MAP.md not found' }));
  }
}

function buildDocsConsistencyReport(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Documentation consistency audit report',
    docsToKeepCurrent: REQUIRED_DOCS
  };
}

module.exports = {
  auditDocsConsistency,
  detectMissingModuleDocs,
  detectOutdatedCommandDocs,
  detectOutdatedEnvDocs,
  detectOutdatedArchitectureDocs,
  buildDocsConsistencyReport
};
