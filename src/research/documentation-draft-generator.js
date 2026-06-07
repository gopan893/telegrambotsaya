'use strict';

const utils = require('./research-utils');

function generateReadmeSection(topic = '', services = {}) {
  return [
    `## ${utils.sanitizeText(topic || 'Project Update', 120)}`,
    '',
    'Ringkasan:',
    '- Jelaskan perubahan utama secara singkat.',
    '- Sebutkan modul/API/command yang terdampak.',
    '- Tandai batasan dan test yang sudah dijalankan.',
    '',
    'Keamanan:',
    '- Jangan menulis token, API key, DATABASE_URL, REDIS_URL, atau secret apa pun.',
    '- Write/external/danger action tetap melalui Evaluation v2 dan executor approval.'
  ].join('\n');
}

function generateEnvDocumentation(envList = [], services = {}) {
  const names = Array.from(new Set((Array.isArray(envList) ? envList : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .map((name) => name.replace(/=.*/, ''))));
  const safeNames = names.length ? names : ['TELEGRAM_TOKEN', 'WEBHOOK_URL', 'DASHBOARD_ENABLED', 'DASHBOARD_ADMIN_TOKEN', 'DATABASE_URL', 'REDIS_URL'];
  return [
    '# Environment Variables',
    '',
    'Dokumen ini hanya mencantumkan nama env, bukan value.',
    '',
    ...safeNames.map((name) => `- \`${utils.sanitizeText(name, 80)}\`: set/missing only; jangan tulis value asli.`),
    '',
    'Security:',
    '- Jangan commit `.env`.',
    '- Rotate secret jika pernah tertempel di chat/log.',
    '- Dashboard/env-check hanya boleh menampilkan set/missing.'
  ].join('\n');
}

function generateCommandDocumentation(commands = [], services = {}) {
  const list = Array.isArray(commands) && commands.length ? commands : ['/research', '/research_task', '/research_report', '/docs_agent', '/docs_draft', '/propose_docs_update'];
  return [
    '# Research & Documentation Commands',
    '',
    ...list.map((cmd) => `- \`${utils.sanitizeText(cmd, 120)}\`: research/docs flow aman; tidak menulis file langsung.`),
    '',
    'Semua proposal update docs harus approval-gated.'
  ].join('\n');
}

function generateTroubleshootingGuide(issue = {}, services = {}) {
  const title = utils.sanitizeText(issue.title || issue.topic || issue.question || issue || 'Troubleshooting', 140);
  return [
    `# Troubleshooting: ${title}`,
    '',
    '## Symptom',
    `- ${title}`,
    '',
    '## Likely Causes',
    '- Env missing or misconfigured.',
    '- Dependency/startup error.',
    '- Dashboard cache serving stale asset.',
    '- Provider/webhook/runtime degraded.',
    '',
    '## Safe Checks',
    '- Check health endpoint.',
    '- Review sanitized deploy/startup logs.',
    '- Run read-only dashboard/observability checks.',
    '',
    '## Safe Mitigation',
    '- Create repair or rollback proposal only if needed.',
    '- Do not run deploy/rollback without Evaluation v2 + executor approval.'
  ].join('\n');
}

function generatePhaseSummaryDoc(phaseNumber, services = {}) {
  const n = String(phaseNumber || '').replace(/[^0-9.]/g, '') || 'X';
  return [
    `# Phase ${n} Summary`,
    '',
    '## Summary',
    '- Isi ringkasan perubahan utama.',
    '',
    '## Files Changed',
    '- Daftar file dibuat/diubah.',
    '',
    '## Tests',
    '- Laporkan PASS/FAIL/SKIPPED jujur.',
    '',
    '## Safety',
    '- Tidak ada secret.',
    '- Tidak ada direct write/external/danger action tanpa approval.',
    '',
    '## Limitations',
    '- Catat hal yang belum diverifikasi.'
  ].join('\n');
}

function generateDocumentationDraft(plan = {}, services = {}) {
  const docType = String(plan.docType || '').toLowerCase();
  let body = '';
  if (docType.includes('env')) body = generateEnvDocumentation(plan.envList || [], services);
  else if (docType.includes('command')) body = generateCommandDocumentation(plan.commands || [], services);
  else if (docType.includes('troubleshooting')) body = generateTroubleshootingGuide(plan.topic || plan, services);
  else if (docType.includes('phase')) body = generatePhaseSummaryDoc(plan.phaseNumber || (String(plan.topic || '').match(/phase\s*(\d+)/i) || [])[1], services);
  else body = generateReadmeSection(plan.topic || 'Documentation Update', services);
  return {
    ok: true,
    draft: {
      id: utils.createId('doc_draft'),
      planId: plan.id || '',
      topic: utils.sanitizeText(plan.topic || 'Documentation draft', 180),
      docType: plan.docType || 'documentation update',
      affectedDocs: plan.affectedDocs || [],
      body: utils.sanitizeText(body, 6000),
      assumptions: plan.assumptions || ['Draft only; no file write performed.'],
      limitations: plan.limitations || [],
      createdAt: utils.nowIso()
    }
  };
}

module.exports = {
  generateCommandDocumentation,
  generateDocumentationDraft,
  generateEnvDocumentation,
  generatePhaseSummaryDoc,
  generateReadmeSection,
  generateTroubleshootingGuide
};

