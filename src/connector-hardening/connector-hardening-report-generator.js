'use strict';

function generateConnectorHardeningReport(connectorId, data) {
  if (!connectorId) return { error: 'connectorId required' };
  const report = {
    connectorId,
    generatedAt: new Date().toISOString(),
    sections: [],
    overallStatus: 'unknown',
    score: 0
  };

  if (data.contract) report.sections.push(generateContractSection(data.contract));
  if (data.permissions) report.sections.push(generatePermissionsSection(data.permissions));
  if (data.health) report.sections.push(generateHealthSection(data.health));
  if (data.tests) report.sections.push(generateTestSection(data.tests));
  if (data.simulations) report.sections.push(generateSimulationSection(data.simulations));

  report.overallStatus = calculateOverallStatus(report.sections);
  report.score = calculateScore(report.sections);

  return report;
}

function generateContractSection(contract) {
  const valid = contract && contract.valid;
  return { title: 'Contract', status: valid ? 'pass' : 'fail', details: contract };
}

function generatePermissionsSection(permissions) {
  const risk = permissions && permissions.risk;
  return { title: 'Permissions', status: risk === 'high' ? 'fail' : risk === 'medium' ? 'warn' : 'pass', details: permissions };
}

function generateHealthSection(health) {
  const statusMap = { healthy: 'pass', degraded: 'warn', unhealthy: 'fail', unknown: 'warn', disconnected: 'fail' };
  return { title: 'Health', status: statusMap[health.status] || 'warn', details: health };
}

function generateTestSection(tests) {
  const allPassed = tests && tests.failed === 0 && tests.total > 0;
  return { title: 'Tests', status: allPassed ? 'pass' : 'fail', details: tests };
}

function generateSimulationSection(simulations) {
  return { title: 'Simulations', status: 'info', details: simulations };
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
    else if (s.status === 'info') score += 75;
    else score += 0;
  }
  return Math.round(score / sections.length);
}

function formatConnectorReport(report) {
  if (!report || report.error) return 'Error: ' + (report && report.error ? report.error : 'No data');
  const lines = [
    '=== Connector Hardening Report ===',
    'Connector: ' + report.connectorId,
    'Status: ' + report.overallStatus,
    'Score: ' + report.score + '/100',
    'Generated: ' + report.generatedAt,
    ''
  ];
  for (const section of report.sections) {
    lines.push('[' + section.status.toUpperCase() + '] ' + section.title);
    if (section.details) {
      const details = typeof section.details === 'object' ? JSON.stringify(section.details, null, 2) : section.details;
      lines.push('  ' + details);
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  generateConnectorHardeningReport, formatConnectorReport,
  calculateOverallStatus, calculateScore
};
