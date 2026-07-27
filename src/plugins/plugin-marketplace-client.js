'use strict';

const MOCK_MARKETPLACE_PLUGINS = [
  { id: 'web_scraper', name: 'Web Scraper', version: '1.0.0', description: 'Extract content from web pages', author: 'community', downloads: 1200, rating: 4.5, type: 'module' },
  { id: 'rss_reader', name: 'RSS Reader', version: '1.2.0', description: 'Subscribe to RSS/Atom feeds', author: 'community', downloads: 890, rating: 4.2, type: 'module' },
  { id: 'markdown_exporter', name: 'Markdown Exporter', version: '0.9.0', description: 'Export data as Markdown files', author: 'core', downloads: 650, rating: 4.0, type: 'hook' },
  { id: 'csv_importer', name: 'CSV Importer', version: '1.1.0', description: 'Import CSV data into the system', author: 'community', downloads: 430, rating: 3.8, type: 'module' },
  { id: 'notification_push', name: 'Push Notifier', version: '2.0.0', description: 'Send push notifications via various channels', author: 'core', downloads: 2100, rating: 4.8, type: 'adapter' }
];

async function searchMarketplace(query = '') {
  const q = query.toLowerCase().trim();
  if (!q) return MOCK_MARKETPLACE_PLUGINS;
  return MOCK_MARKETPLACE_PLUGINS.filter(p =>
    p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.author.toLowerCase().includes(q)
  );
}

async function getMarketplacePlugin(pluginId) {
  return MOCK_MARKETPLACE_PLUGINS.find(p => p.id === pluginId) || null;
}

function listMarketplaceCategories() {
  return ['module', 'middleware', 'hook', 'adapter', 'theme'];
}

module.exports = { searchMarketplace, getMarketplacePlugin, listMarketplaceCategories };
