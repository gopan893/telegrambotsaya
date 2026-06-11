'use strict';

const TEMPLATES = {
  normal_chat: function (data) {
    const message = data.message || '';
    const next = data.nextActions ? '\n\n' + data.nextActions : '';
    return message + next;
  },
  coding_answer: function (data) {
    const lines = ['💻 Coding'];
    if (data.title) lines.push(data.title);
    if (data.summary) lines.push('', data.summary);
    if (data.details) lines.push('', data.details);
    if (data.nextActions) lines.push('', 'Langkah selanjutnya:', data.nextActions);
    return lines.join('\n');
  },
  project_status: function (data) {
    const lines = ['📋 Project'];
    if (data.title) lines.push(data.title);
    if (data.summary) lines.push('', data.summary);
    if (data.status) lines.push('Status:', data.status);
    if (data.blockers) lines.push('Blocker:', data.blockers);
    if (data.nextActions) lines.push('', 'Langkah selanjutnya:', data.nextActions);
    return lines.join('\n');
  },
  task_plan: function (data) {
    const lines = ['📋 Rencana Tugas'];
    if (data.title) lines.push(data.title);
    if (data.summary) lines.push('', data.summary);
    if (data.status) lines.push('Status:', data.status);
    if (data.details) lines.push('', data.details);
    if (data.nextActions) lines.push('', 'Langkah selanjutnya:', data.nextActions);
    return lines.join('\n');
  },
  test_plan: function (data) {
    const lines = ['🧪 Test Plan'];
    if (data.title) lines.push(data.title);
    if (data.summary) lines.push('', data.summary);
    if (data.scope) lines.push('Scope:', data.scope);
    if (data.testCases) lines.push('Test Cases:', data.testCases);
    if (data.nextActions) lines.push('', 'Langkah selanjutnya:', data.nextActions);
    return lines.join('\n');
  },
  risk_review: function (data) {
    const lines = ['⚠️ Risk Review'];
    if (data.title) lines.push(data.title);
    if (data.riskLevel) lines.push('Level:', data.riskLevel);
    if (data.summary) lines.push('', data.summary);
    if (data.mitigation) lines.push('Mitigasi:', data.mitigation);
    if (data.nextActions) lines.push('', 'Rekomendasi:', data.nextActions);
    return lines.join('\n');
  },
  security_warning: function (data) {
    const lines = ['🔒 Security Warning'];
    if (data.message) lines.push(data.message);
    if (data.action) lines.push('', 'Tindakan:', data.action);
    return lines.join('\n');
  },
  privacy_warning: function (data) {
    const lines = ['🔒 Privacy Notice'];
    if (data.message) lines.push(data.message);
    if (data.action) lines.push('', 'Tindakan:', data.action);
    return lines.join('\n');
  },
  approval_required: function (data) {
    const lines = ['⚠️ Approval Diperlukan'];
    if (data.action) lines.push('Aksi:', data.action);
    if (data.reason) lines.push('', 'Alasan:', data.reason);
    if (data.proposalId) lines.push('', 'Proposal:', data.proposalId);
    lines.push('', 'Gunakan /approve ' + (data.proposalId || '<id>') + ' untuk menyetujui.');
    lines.push('Gunakan /reject ' + (data.proposalId || '<id>') + ' untuk menolak.');
    return lines.join('\n');
  },
  proposal_created: function (data) {
    const riskEmoji = { read_only: '📖', low: '🟢', medium: '🟡', high: '🟠', danger: '🔴' };
    const lines = ['📋 Proposal Dibuat'];
    if (data.proposalId) lines.push('ID:', data.proposalId);
    if (data.action) lines.push('Aksi:', data.action);
    if (data.riskLevel) lines.push('Risiko:', (riskEmoji[data.riskLevel] || '⚪') + ' ' + data.riskLevel);
    if (data.status) lines.push('Status:', data.status);
    if (data.details) lines.push('', data.details);
    lines.push('', 'Gunakan /approve ' + (data.proposalId || '<id>') + ' untuk menyetujui.');
    return lines.join('\n');
  },
  workflow_draft: function (data) {
    const lines = ['🔧 Workflow Draft'];
    if (data.title) lines.push(data.title);
    if (data.summary) lines.push('', data.summary);
    if (data.steps) lines.push('Steps:', data.steps);
    if (data.riskLevel) lines.push('Risiko:', data.riskLevel);
    if (data.nextActions) lines.push('', 'Langkah selanjutnya:', data.nextActions);
    return lines.join('\n');
  },
  device_status: function (data) {
    const lines = ['📱 Device Status'];
    if (data.deviceName) lines.push(data.deviceName);
    if (data.status) lines.push('Status:', data.status);
    if (data.health) lines.push('Health:', data.health);
    if (data.lastSeen) lines.push('Last seen:', data.lastSeen);
    if (data.nextActions) lines.push('', 'Langkah selanjutnya:', data.nextActions);
    return lines.join('\n');
  },
  degraded_module: function (data) {
    const lines = ['⚠️ Modul Tidak Tersedia'];
    if (data.moduleName) lines.push('Modul:', data.moduleName);
    if (data.reason) lines.push('Alasan:', data.reason);
    lines.push('', 'Fitur ini sedang tidak tersedia. Coba lagi nanti.');
    return lines.join('\n');
  },
  unknown_command_help: function (data) {
    const lines = ['Perintah tidak dikenal.'];
    if (data.command) lines.push('', data.command);
    lines.push('', 'Gunakan /menu untuk melihat daftar perintah.');
    if (data.suggestion) lines.push('Mungkin maksud Anda:', data.suggestion);
    return lines.join('\n');
  },
  error_safe: function (data) {
    const lines = ['Maaf, saya mengalami kendala.'];
    if (data.message) lines.push('', data.message);
    lines.push('', 'Coba ulangi sebentar lagi. Jika masalah berlanjut, hubungi admin.');
    return lines.join('\n');
  }
};

function renderTemplate(templateName, data) {
  const templateFn = TEMPLATES[templateName];
  if (!templateFn) return TEMPLATES.normal_chat(data || {});
  return templateFn(data || {});
}

function getTemplateNames() {
  return Object.keys(TEMPLATES);
}

function hasTemplate(name) {
  return Boolean(TEMPLATES[name]);
}

module.exports = {
  TEMPLATES,
  getTemplateNames,
  hasTemplate,
  renderTemplate
};
