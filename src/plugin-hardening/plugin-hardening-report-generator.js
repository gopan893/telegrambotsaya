'use strict';

function generateHardeningReport(pluginId, data) {
  if (!pluginId) return { error: 'pluginId required' };
  const report = {
    pluginId,
    generatedAt: new Date().toISOString(),
    sections: [],
    overallStatus: 'unknown',
    score: 0
  };

  if (data.manifest) report.sections.push(generateManifestSection(data.manifest));
  if (data.compatibility) report.sections.push(generateCompatibilitySection(data.compatibility));
  if (data.permissions) report.sections.push(generatePermissionsSection(data.permissions));
  if (data.sandbox) report.sections.push(generateSandboxSection(data.sandbox));
  if (data.lifecycle) report.sections.push(generateLifecycleSection(data.lifecycle));
  if (data.health) report.sections.push(generateHealthSection(data.health));
  if (data.risk) report.sections.push(generateRiskSection(data.risk));
  if (data.certification) report.sections.push(generateCertificationSection(data.certification));
  if (data.upgradePlan) report.sections.push(generateUpgradeSection(data.upgradePlan));
  if (data.deprecation) report.sections.push(generateDeprecationSection(data.deprecation));

  report.overallStatus = calculateOverallStatus(report.sections);
  report.score = calculateScore(report.sections);

  return report;
}

function generateManifestSection(manifest) {
  const valid = manifest.id && manifest.name && manifest.version && manifest.main;
  return { title: 'Manifest', status: valid ? 'pass' : 'fail', details: { id: manifest.id, name: manifest.name, version: manifest.version, type: manifest.type || 'module' } };
}

function generateCompatibilitySection(compat) {
  return { title: 'Compatibility', status: compat.compatible ? 'pass' : 'warn', details: { compatible: compat.compatible, warnings: compat.allWarnings || [] } };
}

function generatePermissionsSection(perms) {
  const dangerous = (perms.permissions || []).filter(p => ['shell', 'filesystem_write', 'token_access', 'deploy', 'push', 'release', 'rollback'].includes(p));
  return { title: 'Permissions', status: dangerous.length > 0 ? 'fail' : 'pass', details: { permissions: perms.permissions || [], dangerous, risk: perms.risk || 'low' } };
}

function generateSandboxSection(sandbox) {
  const valid = sandbox && !sandbox.filesystemWrite && !sandbox.shellEnabled && !sandbox.secretAccess;
  return { title: 'Sandbox', status: valid ? 'pass' : 'fail', details: sandbox };
}

function generateLifecycleSection(lifecycle) {
  return { title: 'Lifecycle', status: lifecycle.state === 'enabled' ? 'pass' : 'warn', details: { state: lifecycle.state, enabled: lifecycle.enabled } };
}

function generateHealthSection(health) {
  const statusMap = { healthy: 'pass', degraded: 'warn', unhealthy: 'fail', unknown: 'warn' };
  return { title: 'Health', status: statusMap[health.status] || 'warn', details: { status: health.status, errors: health.errorCount || 0, warnings: health.warningCount || 0, drifts: health.driftCount || 0 } };
}

function generateRiskSection(risk) {
  return { title: 'Risk', status: risk.level === 'low' ? 'pass' : risk.level === 'medium' ? 'warn' : 'fail', details: { score: risk.score, level: risk.level } };
}

function generateCertificationSection(cert) {
  return { title: 'Certification', status: cert.certified ? 'pass' : 'fail', details: { certified: cert.certified, blockReason: cert.blockReason } };
}

function generateUpgradeSection(upgrade) {
  return { title: 'Upgrade', status: upgrade.status === 'completed' ? 'pass' : 'info', details: { currentVersion: upgrade.currentVersion, targetVersion: upgrade.targetVersion, risks: upgrade.risks ? upgrade.risks.length : 0 } };
}

function generateDeprecationSection(deprecation) {
  return { title: 'Deprecation', status: deprecation.status === 'deprecated' ? 'warn' : 'pass', details: { status: deprecation.status, reason: deprecation.reason } };
}

function calculateOverallStatus(sections) {
  if (!sections || sections.length === 0) return 'unknown';
  if (sections.some(s => s.status === 'fail')) return 'fail';
  if (sections.some(s => s.status === 'warn')) return 'warn';
  return 'pass';
}

function calculateScore(sections) {
  if (!sections || sections.length === 0) return 0;
  let score = 0;
  for (const s of sections) {
    if (s.status === 'pass') score += 100;
    else if (s.status === 'warn') score += 50;
    else score += 0;
  }
  return Math.round(score / sections.length);
}

function formatReport(report) {
  if (!report || report.error) return 'Error: ' + (report && report.error ? report.error : 'No data');
  const lines = [
    '=== Plugin Hardening Report ===',
    'Plugin: ' + report.pluginId,
    'Status: ' + report.overallStatus,
    'Score: ' + report.score + '/100',
    'Generated: ' + report.generatedAt,
    ''
  ];
  for (const section of report.sections) {
    lines.push('[' + section.status.toUpperCase() + '] ' + section.title);
    if (section.details) {
      for (const [k, v] of Object.entries(section.details)) {
        lines.push('  ' + k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v));
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { generateHardeningReport, formatReport, calculateOverallStatus, calculateScore };
