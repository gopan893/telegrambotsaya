'use strict';

const utils = require('./githubops-utils');
const store = require('./githubops-store');

function createCommitPlan(manifest) {
  if (!manifest || !manifest.files || !manifest.files.length) {
    return { ok: false, error: 'No files to commit' };
  }

  const files = manifest.files;
  const grouped = manifest.classified || {};
  const areas = Object.entries(grouped).filter(([_, v]) => v.length > 0).map(([k]) => k);

  const plan = {
    id: utils.shortId(),
    files,
    fileCount: files.length,
    areas,
    docsOnly: manifest.docsOnly,
    suggestedMessage: suggestCommitMessage(manifest),
    warnings: [],
    timestamp: utils.now()
  };

  if (files.length > 20) {
    plan.warnings.push('Large commit — consider splitting');
    plan.splitSuggested = true;
  }

  const envFiles = files.filter(f => f.includes('.env') || f.includes('.env.example') || f.includes('credentials'));
  if (envFiles.length) {
    plan.warnings.push(`Contains environment/credential files: ${envFiles.join(', ')}`);
    plan.hasEnvFiles = true;
  }

  store.addCommitPlan(plan);
  return { ok: true, plan };
}

function suggestCommitMessage(manifest) {
  const areas = [];
  if (manifest.classified?.dashboard?.length) areas.push('dashboard');
  if (manifest.classified?.agents?.length) areas.push('agents');
  if (manifest.classified?.executor?.length) areas.push('executor');
  if (manifest.classified?.integrations?.length) areas.push('integrations');
  if (manifest.classified?.coding?.length) areas.push('coding');
  if (manifest.classified?.routines?.length) areas.push('routines');
  if (manifest.classified?.selfhealing?.length) areas.push('selfhealing');
  if (manifest.classified?.monitoring?.length) areas.push('monitoring');
  if (manifest.classified?.cicd?.length) areas.push('cicd');
  if (manifest.classified?.docs?.length) areas.push('docs');
  if (manifest.classified?.tests?.length) areas.push('tests');
  if (manifest.docsOnly) return 'docs: ' + (manifest.files[0] || 'update documentation');

  const prefix = areas[0] || 'chore';
  const count = manifest.files.length;
  return `${prefix}: update ${count} file(s) — ${areas.slice(0, 3).join(', ')}${areas.length > 3 ? '...' : ''}`;
}

function splitCommitPlanIfLarge(manifest) {
  if (!manifest || !manifest.files || manifest.files.length <= 20) return null;
  const groups = manifest.classified || {};
  const plans = [];
  for (const [area, files] of Object.entries(groups)) {
    if (files.length) {
      plans.push({
        area,
        files,
        suggestedMessage: `${area}: update ${files.length} file(s)`,
        fileCount: files.length
      });
    }
  }
  return plans.length ? plans : null;
}

function validateCommitPlan(plan) {
  const issues = [];
  if (!plan || !plan.files) return { ok: false, issues: ['No plan data'] };
  if (plan.fileCount === 0) issues.push('No files to commit');
  if (plan.fileCount > 50) issues.push('Excessive file count — split recommended');
  if (plan.hasEnvFiles) issues.push('Contains credential files — verify before commit');
  return { ok: issues.length === 0, issues };
}

module.exports = {
  createCommitPlan,
  suggestCommitMessage,
  splitCommitPlanIfLarge,
  validateCommitPlan
};
