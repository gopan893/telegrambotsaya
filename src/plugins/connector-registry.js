'use strict';

const builtInConnectors = [
  { id: 'http_webhook', name: 'HTTP Webhook', type: 'webhook', version: '1.0.0', category: 'network', authMethods: ['none', 'bearer', 'basic'], builtIn: true, enabled: true },
  { id: 'slack_webhook', name: 'Slack Webhook', type: 'webhook', version: '1.0.0', category: 'messaging', authMethods: ['bearer'], builtIn: true, enabled: true },
  { id: 'discord_webhook', name: 'Discord Webhook', type: 'webhook', version: '1.0.0', category: 'messaging', authMethods: ['bearer'], builtIn: true, enabled: true },
  { id: 'github_api', name: 'GitHub API', type: 'api', version: '1.0.0', category: 'devtools', authMethods: ['token', 'oauth'], builtIn: true, enabled: true },
  { id: 'gitlab_api', name: 'GitLab API', type: 'api', version: '1.0.0', category: 'devtools', authMethods: ['token'], builtIn: true, enabled: false },
  { id: 'jira_api', name: 'Jira API', type: 'api', version: '1.0.0', category: 'project_management', authMethods: ['basic', 'token'], builtIn: true, enabled: false },
  { id: 'linear_api', name: 'Linear API', type: 'api', version: '1.0.0', category: 'project_management', authMethods: ['token'], builtIn: true, enabled: false },
  { id: 'notion_api', name: 'Notion API', type: 'api', version: '1.0.0', category: 'knowledge', authMethods: ['token'], builtIn: true, enabled: false },
  { id: 'confluence_api', name: 'Confluence API', type: 'api', version: '1.0.0', category: 'knowledge', authMethods: ['basic', 'token'], builtIn: true, enabled: false },
  { id: 'google_drive', name: 'Google Drive', type: 'oauth', version: '1.0.0', category: 'storage', authMethods: ['oauth'], builtIn: true, enabled: false },
  { id: 'dropbox_api', name: 'Dropbox API', type: 'api', version: '1.0.0', category: 'storage', authMethods: ['token'], builtIn: true, enabled: false },
  { id: 'smtp_email', name: 'SMTP Email', type: 'smtp', version: '1.0.0', category: 'communication', authMethods: ['basic'], builtIn: true, enabled: false },
  { id: 'telegram_bot', name: 'Telegram Bot', type: 'api', version: '1.0.0', category: 'messaging', authMethods: ['token'], builtIn: true, enabled: true },
  { id: 'openweather_api', name: 'OpenWeather API', type: 'api', version: '1.0.0', category: 'utility', authMethods: ['apikey'], builtIn: true, enabled: false },
  { id: 'serp_api', name: 'SERP API', type: 'api', version: '1.0.0', category: 'search', authMethods: ['apikey'], builtIn: true, enabled: false }
];

function getBuiltInConnectors() {
  return builtInConnectors.map(c => ({ ...c }));
}

function findConnectorRegistry(connectorId) {
  return builtInConnectors.find(c => c.id === connectorId) || null;
}

function listConnectorCategories() {
  const cats = new Set(builtInConnectors.map(c => c.category));
  return Array.from(cats).sort();
}

module.exports = { getBuiltInConnectors, findConnectorRegistry, listConnectorCategories };
