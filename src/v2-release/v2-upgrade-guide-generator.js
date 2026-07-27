'use strict';

function generateV2UpgradeGuide(services) {
  const env = generateV2EnvChanges(services);
  const dashboard = generateV2DashboardChanges(services);
  const commands = generateV2CommandChanges(services);
  const compatibility = generateV2CompatibilityNotes(services);
  const checklist = generateV2ManualVerificationChecklist(services);

  return `
# V2.0.0 Upgrade Guide

## Environment Changes
${env}

## Dashboard Changes
${dashboard}

## Command Changes
${commands}

## Compatibility Notes
${compatibility}

## Manual Verification Checklist
${checklist}
`.trim();
}

function generateV2EnvChanges(services) {
  const envVars = (services && services.envV2) || ['V2_REGISTRY_URL', 'V2_DASHBOARD_URL', 'V2_BOUNDARY_ENDPOINT'];
  return envVars.map(v => `- ${v}: Updated for v2`).join('\n') || 'None';
}

function generateV2DashboardChanges(services) {
  const changes = (services && services.dashboardChanges) || [
    'New registry v2 management tab',
    'Boundary health monitoring widget',
    'Performance budget dashboard',
  ];
  return changes.map(c => `- ${c}`).join('\n') || 'None';
}

function generateV2CommandChanges(services) {
  const changes = (services && services.commandChanges) || [
    'release: new subcommands for v2 release lifecycle',
    'registry: updated for registry v2 API',
  ];
  return changes.map(c => `- ${c}`).join('\n') || 'None';
}

function generateV2CompatibilityNotes(services) {
  const notes = (services && services.compatibilityNotes) || [
    'v1 commands remain functional via alias layer',
    'v1 dashboard tabs continue to work',
    'v1 storage format unchanged',
  ];
  return notes.map(n => `- ${n}`).join('\n') || 'None';
}

function generateV2ManualVerificationChecklist(services) {
  const steps = (services && services.manualSteps) || [
    'Verify dashboard loads all v2 tabs without errors',
    'Run a test command through the new registry v2',
    'Check boundary certification status',
    'Confirm performance budget is respected',
    'Validate safety boundary constraints',
  ];
  return steps.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'None';
}

module.exports = {
  generateV2UpgradeGuide,
  generateV2EnvChanges,
  generateV2DashboardChanges,
  generateV2CommandChanges,
  generateV2CompatibilityNotes,
  generateV2ManualVerificationChecklist,
};
