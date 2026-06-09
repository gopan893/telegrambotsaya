'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // searchMarketplace - no query returns all
  const all = await plugins.pluginMarketplaceClient.searchMarketplace();
  assert(Array.isArray(all), 'searchMarketplace returns array');
  assert(all.length === 5, 'searchMarketplace returns 5 plugins');

  // Check first plugin details
  const scraper = all.find(p => p.id === 'web_scraper');
  assert(scraper, 'web_scraper exists');
  assert(scraper.name === 'Web Scraper', 'web_scraper name correct');
  assert(scraper.type === 'module', 'web_scraper type module');
  assert(scraper.rating === 4.5, 'web_scraper rating 4.5');

  // searchMarketplace with query
  const rssResults = await plugins.pluginMarketplaceClient.searchMarketplace('rss');
  assert(rssResults.length === 1, 'search "rss" returns 1 result');
  assert(rssResults[0].id === 'rss_reader', 'search rss returns rss_reader');

  const notificationResults = await plugins.pluginMarketplaceClient.searchMarketplace('push');
  assert(notificationResults.length === 1, 'search "push" returns 1 result');
  assert(notificationResults[0].id === 'notification_push', 'search push returns notification_push');

  const caseInsensitive = await plugins.pluginMarketplaceClient.searchMarketplace('MARKDOWN');
  assert(caseInsensitive.length === 1, 'case insensitive search works');
  assert(caseInsensitive[0].id === 'markdown_exporter', 'case insensitive match');

  // Empty query returns all
  const emptyQuery = await plugins.pluginMarketplaceClient.searchMarketplace('');
  assert(emptyQuery.length === 5, 'empty query returns all');

  // getMarketplacePlugin
  const plugin = await plugins.pluginMarketplaceClient.getMarketplacePlugin('rss_reader');
  assert(plugin !== null, 'getMarketplacePlugin returns plugin');
  assert(plugin.version === '1.2.0', 'getMarketplacePlugin version');
  assert(plugin.author === 'community', 'getMarketplacePlugin author');

  const nullPlugin = await plugins.pluginMarketplaceClient.getMarketplacePlugin('nonexistent');
  assert(nullPlugin === null, 'getMarketplacePlugin nonexistent returns null');

  // listMarketplaceCategories
  const cats = plugins.pluginMarketplaceClient.listMarketplaceCategories();
  assert(Array.isArray(cats), 'listMarketplaceCategories returns array');
  assert(cats.includes('module'), 'categories includes module');
  assert(cats.includes('hook'), 'categories includes hook');
  assert(cats.includes('adapter'), 'categories includes adapter');
  assert(cats.includes('theme'), 'categories includes theme');
  assert(cats.length === 5, '5 categories total');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
