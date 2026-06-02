'use strict';

function formatRunForTelegram(run = {}) {
  if (!run) return 'Belum ada evaluation run. Jalankan /evalagents.';
  const failed = (run.failures || []).slice(0, 5);
  return [
    'Agent Evaluation v2',
    `Run: ${run.id}`,
    `Status: ${run.status}`,
    `Average: ${run.averageScore}%`,
    `Passed: ${run.passedCases}/${run.totalCases}`,
    `Quality gates: ${run.qualityGateStatus || 'unknown'}`,
    failed.length ? `Failures:\n${failed.map(item => `- ${item.caseId || 'case'}: ${(item.failures || []).join('; ')}`).join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

function formatQualityGatesForTelegram(quality = {}) {
  if (!quality || !quality.gates) return 'Quality gates belum tersedia. Jalankan /evalagents.';
  const failed = quality.failedGates || [];
  return [
    'Agent Quality Gates',
    `Status: ${quality.status || (failed.length ? 'failed' : 'passed')}`,
    failed.length ? failed.map(item => `- ${item.key}: ${item.value}/${item.threshold}`).join('\n') : 'Semua gate lulus.'
  ].join('\n');
}

module.exports = {
  formatQualityGatesForTelegram,
  formatRunForTelegram
};
