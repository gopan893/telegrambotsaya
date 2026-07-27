'use strict';

const utils = require('./githubops-utils');
const store = require('./githubops-store');

function classifyChangedFiles(files) {
  const classified = { dashboard: [], agents: [], executor: [], integrations: [], coding: [], routines: [], selfhealing: [], monitoring: [], cicd: [], docs: [], tests: [], other: [] };
  for (const f of files) {
    if (f.startsWith('public/dashboard') || f.startsWith('src/dashboard')) classified.dashboard.push(f);
    else if (f.startsWith('src/agents')) classified.agents.push(f);
    else if (f.startsWith('src/executor')) classified.executor.push(f);
    else if (f.startsWith('src/integrations')) classified.integrations.push(f);
    else if (f.startsWith('src/coding')) classified.coding.push(f);
    else if (f.startsWith('src/routines')) classified.routines.push(f);
    else if (f.startsWith('src/selfhealing')) classified.selfhealing.push(f);
    else if (f.startsWith('src/monitoring')) classified.monitoring.push(f);
    else if (f.startsWith('src/cicd') || f.startsWith('.github')) classified.cicd.push(f);
    else if (f.startsWith('docs/')) classified.docs.push(f);
    else if (f.startsWith('scratch/test-')) classified.tests.push(f);
    else classified.other.push(f);
  }
  return classified;
}

function detectDashboardChanges(files) {
  return files.filter(f => f.startsWith('public/dashboard') || f.startsWith('src/dashboard'));
}

function detectExecutorChanges(files) {
  return files.filter(f => f.startsWith('src/executor'));
}

function detectIntegrationChanges(files) {
  return files.filter(f => f.startsWith('src/integrations'));
}

function detectAgentRoutingChanges(files) {
  return files.filter(f => f.includes('agent') || f.includes('router') || f.includes('natural'));
}

function detectCicdChanges(files) {
  return files.filter(f => f.startsWith('.github') || f.startsWith('src/cicd'));
}

function detectDocsOnlyChange(files) {
  return files.length > 0 && files.every(f => f.startsWith('docs/') || f.endsWith('.md'));
}

function buildChangeRiskSummary(manifest) {
  const risks = [];
  const classified = manifest.classified || {};
  if (classified.dashboard.length) risks.push('Dashboard changes — verify route registry');
  if (classified.executor.length) risks.push('Executor changes — verify boundary');
  if (classified.integrations.length) risks.push('Integration changes — verify gate');
  if (classified.agents.length) risks.push('Agent routing changes — verify natural chat');
  if (classified.cicd.length) risks.push('CI/CD changes — verify workflow');
  if (classified.selfhealing.length) risks.push('Self-healing changes — verify guards');
  if (classified.routines.length) risks.push('Routine changes — verify scheduler');
  if (manifest.totalChanged > 20) risks.push('Large change set — prefer smaller commits');
  return risks;
}

function buildGitChangeManifest(repoState) {
  const files = repoState.changedFiles || [];
  const classified = classifyChangedFiles(files);
  const manifest = {
    id: utils.shortId(),
    totalChanged: files.length,
    files,
    classified,
    dashboardChanges: classified.dashboard,
    executorChanges: classified.executor,
    integrationChanges: classified.integrations,
    agentRoutingChanges: detectAgentRoutingChanges(files),
    cicdChanges: detectCicdChanges(files),
    docsOnly: detectDocsOnlyChange(files),
    risks: buildChangeRiskSummary({ classified, totalChanged: files.length }),
    timestamp: utils.now()
  };
  store.setChangeManifest(manifest);
  return manifest;
}

module.exports = {
  classifyChangedFiles,
  detectDashboardChanges,
  detectExecutorChanges,
  detectIntegrationChanges,
  detectAgentRoutingChanges,
  detectCicdChanges,
  detectDocsOnlyChange,
  buildChangeRiskSummary,
  buildGitChangeManifest
};
