'use strict';

const TEMPLATES = [
  { id: 'daily_summary', name: 'Daily Summary', description: 'Generate daily system summary', steps: [{ type: 'read', name: 'Collect metrics', source: 'system' }, { type: 'analyze', name: 'Analyze data', source: 'metrics' }, { type: 'notify', name: 'Send summary', channel: 'default', message: 'Daily summary ready' }], riskLevel: 'low', trigger: { type: 'schedule', cron: '0 8 * * *' } },
  { id: 'error_alert', name: 'Error Alert', description: 'Alert on system errors', steps: [{ type: 'read', name: 'Check errors', source: 'logs' }, { type: 'notify', name: 'Send alert', channel: 'alerts', message: 'Error detected' }], riskLevel: 'low', trigger: { type: 'event', event: 'error_detected' } },
  { id: 'weekly_review', name: 'Weekly Review', description: 'Weekly performance review', steps: [{ type: 'read', name: 'Collect weekly data', source: 'system' }, { type: 'analyze', name: 'Analyze performance', source: 'weekly' }, { type: 'rag_search', name: 'Search past reviews', query: 'weekly review' }], riskLevel: 'low', trigger: { type: 'schedule', cron: '0 9 * * 1' } },
  { id: 'deploy_check', name: 'Deploy Check', description: 'Pre-deploy validation', steps: [{ type: 'read', name: 'Check readiness', source: 'deploy' }, { type: 'external_read', name: 'Validate environment', target: 'production' }], riskLevel: 'medium', trigger: { type: 'manual' } },
  { id: 'backup_workflow', name: 'Backup Workflow', description: 'System backup workflow', steps: [{ type: 'read', name: 'Check backup targets', source: 'backup' }, { type: 'internal_write', name: 'Run backup', target: 'backup' }, { type: 'notify', name: 'Backup complete', channel: 'default', message: 'Backup finished' }], riskLevel: 'low', trigger: { type: 'schedule', cron: '0 2 * * *' } },
  { id: 'health_monitor', name: 'Health Monitor', description: 'Continuous health monitoring', steps: [{ type: 'read', name: 'Check health', source: 'health' }, { type: 'analyze', name: 'Analyze health', source: 'health' }, { type: 'notify', name: 'Health alert', channel: 'alerts', message: 'Health check complete' }], riskLevel: 'low', trigger: { type: 'event', event: 'health_degraded' } }
];

function listTemplates() {
  return [...TEMPLATES];
}

function getTemplate(templateId) {
  return TEMPLATES.find(t => t.id === templateId) || null;
}

function createFromTemplate(templateId, overrides) {
  const template = getTemplate(templateId);
  if (!template) return { ok: false, error: 'Template not found' };
  const workflow = {
    ...template,
    ...(overrides || {}),
    id: overrides && overrides.id ? overrides.id : template.id + '_' + Date.now().toString(36),
    name: (overrides && overrides.name) || template.name,
    status: 'draft',
    createdFrom: templateId,
    createdAt: new Date().toISOString()
  };
  return { ok: true, workflow };
}

function searchTemplates(query) {
  if (!query) return listTemplates();
  const lower = query.toLowerCase();
  return TEMPLATES.filter(t => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower));
}

module.exports = { listTemplates, getTemplate, createFromTemplate, searchTemplates, TEMPLATES };
