'use strict';

const templates = [
  {
    id: 'daily_summary', name: 'Daily Summary', description: 'Send a daily summary of activities and insights',
    trigger: { type: 'schedule', params: { cron: '0 8 * * *' } },
    conditions: [], actions: [
      { type: 'run_health_check', params: { scope: 'quick' } },
      { type: 'create_insight', params: { category: 'daily', content: '$dailySummary' } },
      { type: 'send_message', params: { channel: 'telegram', text: '📋 Daily Summary: $summaryText' } }
    ], tags: ['daily', 'productivity']
  },
  {
    id: 'weekly_review', name: 'Weekly Review', description: 'Weekly review of goals and progress',
    trigger: { type: 'schedule', params: { cron: '0 9 * * 1' } },
    conditions: [], actions: [
      { type: 'run_research', params: { query: 'weekly progress overview', depth: 'light' } },
      { type: 'create_memory', params: { content: 'Weekly review completed', type: 'review', tags: ['weekly'] } },
      { type: 'send_message', params: { channel: 'telegram', text: '📈 Weekly Review: $reviewText' } }
    ], tags: ['weekly', 'review']
  },
  {
    id: 'error_alert', name: 'Error Alert', description: 'Alert when errors are detected',
    trigger: { type: 'error_detected', params: { severity: 'high' } },
    conditions: [{ type: 'greater_than', field: '$errorCount', value: 3 }],
    actions: [
      { type: 'send_notification', params: { title: '⚠️ High Error Rate', body: '$errorCount errors detected in $module', priority: 'high' } },
      { type: 'create_memory', params: { content: 'Error alert triggered: $errorCount errors', type: 'alert', tags: ['error'] } }
    ], tags: ['monitoring', 'alert']
  },
  {
    id: 'goal_milestone', name: 'Goal Milestone Celebrated', description: 'Celebrate when a goal is completed',
    trigger: { type: 'goal_completed', params: {} },
    conditions: [], actions: [
      { type: 'send_message', params: { channel: 'telegram', text: '🎉 Goal completed: $goalTitle! Great work!' } },
      { type: 'create_insight', params: { category: 'achievement', content: 'Completed goal: $goalTitle' } }
    ], tags: ['productivity', 'celebration']
  },
  {
    id: 'weekly_health_check', name: 'Weekly Health Check', description: 'Run a full health check weekly',
    trigger: { type: 'schedule', params: { cron: '0 6 * * 0' } },
    conditions: [], actions: [
      { type: 'run_health_check', params: { scope: 'full' } },
      { type: 'log_event', params: { action: 'health_check', detail: 'Weekly health check completed' } },
      { type: 'send_message', params: { channel: 'telegram', text: '🩺 Weekly health check: $healthStatus' } }
    ], tags: ['monitoring', 'weekly']
  },
  {
    id: 'webhook_data_ingest', name: 'Webhook Data Ingestion', description: 'Process incoming webhook data',
    trigger: { type: 'webhook', params: { path: '/ingest', method: 'POST' } },
    conditions: [{ type: 'exists', field: '$payload.data' }],
    actions: [
      { type: 'create_memory', params: { content: '$payload.data', type: 'ingested', tags: ['webhook'] } },
      { type: 'log_event', params: { action: 'webhook_ingested', detail: 'Data ingested via webhook' } }
    ], tags: ['integration', 'data']
  }
];

function getTemplate(templateId) {
  return templates.find(t => t.id === templateId) || null;
}

function listTemplates(tag) {
  if (tag) return templates.filter(t => t.tags.includes(tag));
  return templates.map(t => ({ ...t }));
}

function createRecipeFromTemplate(templateId, overrides = {}) {
  const template = getTemplate(templateId);
  if (!template) return null;
  const store = require('./recipe-store');
  return store.createRecipe({
    name: overrides.name || template.name,
    description: template.description,
    trigger: overrides.trigger || template.trigger,
    conditions: overrides.conditions || template.conditions,
    actions: overrides.actions || template.actions,
    tags: template.tags,
    variables: overrides.variables || {}
  });
}

module.exports = { getTemplate, listTemplates, createRecipeFromTemplate };
