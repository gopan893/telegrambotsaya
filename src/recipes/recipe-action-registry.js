'use strict';

const builtInActions = {
  send_message: { name: 'Send Message', description: 'Send a message via Telegram or other channel', params: ['channel', 'text', 'parse_mode'], category: 'communication' },
  send_notification: { name: 'Send Notification', description: 'Send a push notification', params: ['title', 'body', 'priority'], category: 'communication' },
  create_memory: { name: 'Create Memory', description: 'Store a new memory entry', params: ['content', 'type', 'tags'], category: 'storage' },
  create_goal: { name: 'Create Goal', description: 'Create a new goal', params: ['title', 'deadline', 'priority'], category: 'productivity' },
  update_goal: { name: 'Update Goal', description: 'Update goal progress or status', params: ['goal_id', 'status', 'progress'], category: 'productivity' },
  create_insight: { name: 'Create Insight', description: 'Generate an insight entry', params: ['category', 'content'], category: 'analysis' },
  log_event: { name: 'Log Event', description: 'Write an event to the audit log', params: ['action', 'detail'], category: 'system' },
  run_health_check: { name: 'Run Health Check', description: 'Run a system health check', params: ['scope'], category: 'monitoring' },
  trigger_workflow: { name: 'Trigger Workflow', description: 'Trigger another workflow or recipe', params: ['workflow_id', 'params'], category: 'orchestration' },
  run_research: { name: 'Run Research', description: 'Execute a research task', params: ['query', 'depth'], category: 'research' },
  export_data: { name: 'Export Data', description: 'Export data to a file', params: ['format', 'scope'], category: 'data' },
  call_connector: { name: 'Call Connector', description: 'Call an external connector API', params: ['connector_id', 'endpoint', 'payload'], category: 'integration' },
  http_request: { name: 'HTTP Request', description: 'Make an HTTP request', params: ['url', 'method', 'headers', 'body'], category: 'network' },
  set_variable: { name: 'Set Variable', description: 'Set a recipe variable', params: ['name', 'value'], category: 'logic' },
  condition_branch: { name: 'Condition Branch', description: 'Branch execution based on a condition', params: ['condition', 'then', 'else'], category: 'logic' },
  delay: { name: 'Delay', description: 'Wait for a specified duration', params: ['duration_ms'], category: 'flow_control' }
};

function getAction(actionType) {
  return builtInActions[actionType] || null;
}

function listActions(category) {
  const entries = Object.entries(builtInActions);
  if (category) return entries.filter(([, v]) => v.category === category).map(([k, v]) => ({ id: k, ...v }));
  return entries.map(([k, v]) => ({ id: k, ...v }));
}

function listActionCategories() {
  return Array.from(new Set(Object.values(builtInActions).map(a => a.category))).sort();
}

module.exports = { getAction, listActions, listActionCategories };
