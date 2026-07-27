'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

function buildChangeManifestFromDiff(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const manifest = {
    id: utils.shortId(),
    patchPlanId: null,
    filesChanged: [],
    newFiles: [],
    modifiedFiles: [],
    deletedFiles: [],
    routeChanges: [],
    dashboardTabChanges: [],
    apiChanges: [],
    commandChanges: [],
    testChanges: [],
    docsChanges: [],
    riskNotes: [],
    createdAt: utils.now()
  };

  try {
    const { execSync } = require('child_process');
    const status = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4096 }).toString();
    const diff = execSync('git diff --stat', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4096 }).toString();
    const lines = status.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const trimmed = line.trim();
      const prefix = trimmed.substring(0, 2);
      const filePath = trimmed.substring(3).trim();
      manifest.filesChanged.push(filePath);
      if (prefix.includes('??')) {
        manifest.newFiles.push(filePath);
      } else if (prefix.startsWith('D')) {
        manifest.deletedFiles.push(filePath);
      } else if (prefix.startsWith('M') || prefix.startsWith('?')) {
        manifest.modifiedFiles.push(filePath);
      }
    }

    manifest.filesChanged.forEach(f => {
      if (f.includes('route') || f.includes('Route')) manifest.routeChanges.push(f);
      if (f.includes('dashboard') && (f.includes('state.js') || f.includes('ui.js') || f.includes('index.html'))) manifest.dashboardTabChanges.push(f);
      if (f.includes('api.js') || f.includes('Api')) manifest.apiChanges.push(f);
      if (f.includes('telebot') || f.includes('command') || f.includes('Command')) manifest.commandChanges.push(f);
      if (f.startsWith('scratch/test-')) manifest.testChanges.push(f);
      if (f.startsWith('docs/') || f.endsWith('.md')) manifest.docsChanges.push(f);
    });

    const dashRoutes = path.join(repoRoot, 'src', 'dashboard', 'dashboard-routes.js');
    if (fs.existsSync(dashRoutes)) {
      const content = fs.readFileSync(dashRoutes, 'utf8');
    }
  } catch (_) {
    manifest.riskNotes.push('Could not read git status');
  }

  return manifest;
}

function validateChangeManifest(manifest) {
  const warnings = [];
  const errors = [];

  if (!manifest.filesChanged.length) {
    warnings.push('No files changed in manifest');
  }

  if (manifest.newFiles.length > 10) {
    warnings.push(`Large number of new files: ${manifest.newFiles.length}`);
  }

  if (manifest.routeChanges.length > 0) {
    warnings.push('Route changes detected — verify dashboard route consistency');
  }

  if (manifest.dashboardTabChanges.length > 0) {
    warnings.push('Dashboard tab changes detected — verify tab registry');
  }

  const sensitiveDirs = ['config/', '.env', 'node_modules/'];
  for (const file of manifest.filesChanged) {
    for (const sd of sensitiveDirs) {
      if (file.startsWith(sd)) {
        errors.push(`Sensitive file changed: ${file}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function linkManifestToHandoff(manifestId, handoffId, services) {
  const manifests = store.getChangeManifests(services);
  const manifest = manifests.find(m => m.id === manifestId);
  if (!manifest) return { ok: false, error: 'Manifest not found' };
  manifest.patchPlanId = handoffId;
  return { ok: true };
}

module.exports = {
  buildChangeManifestFromDiff,
  validateChangeManifest,
  linkManifestToHandoff
};
