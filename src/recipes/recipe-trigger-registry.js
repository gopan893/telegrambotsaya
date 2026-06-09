'use strict';

const builtInTriggers = {
  manual: { name: 'Manual', description: 'Triggered manually via command or dashboard', params: [], category: 'manual' },
  schedule: { name: 'Schedule', description: 'Triggered at a specific time or interval', params: ['cron', 'timezone'], category: 'time' },
  webhook: { name: 'Webhook', description: 'Triggered by an incoming webhook call', params: ['path', 'method'], category: 'network' },
  file_change: { name: 'File Change', description: 'Triggered when a file is created, modified, or deleted', params: ['path', 'event'], category: 'filesystem' },
  memory_added: { name: 'Memory Added', description: 'Triggered when new memory is stored', params: ['type', 'source'], category: 'system' },
  goal_completed: { name: 'Goal Completed', description: 'Triggered when a goal is marked complete', params: ['goal_id'], category: 'system' },
  insight_generated: { name: 'Insight Generated', description: 'Triggered when a new insight is created', params: ['category'], category: 'system' },
  error_detected: { name: 'Error Detected', description: 'Triggered when an error is logged', params: ['severity', 'module'], category: 'monitoring' },
  health_degraded: { name: 'Health Degraded', description: 'Triggered when system health drops below threshold', params: ['threshold'], category: 'monitoring' },
  external_event: { name: 'External Event', description: 'Triggered by an external connected service event', params: ['connector', 'event'], category: 'integration' }
};

function getTrigger(triggerType) {
  return builtInTriggers[triggerType] || null;
}

function listTriggers(category) {
  const entries = Object.entries(builtInTriggers);
  if (category) return entries.filter(([, v]) => v.category === category).map(([k, v]) => ({ id: k, ...v }));
  return entries.map(([k, v]) => ({ id: k, ...v }));
}

function listTriggerCategories() {
  return Array.from(new Set(Object.values(builtInTriggers).map(t => t.category))).sort();
}

module.exports = { getTrigger, listTriggers, listTriggerCategories };
