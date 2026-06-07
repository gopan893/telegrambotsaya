'use strict';

const utils = require('./portfolio-utils');

const PORTFOLIOS_KEY = 'portfolio_managers';
const PORTFOLIO_LINKS_KEY = 'portfolio_proposals';

function memoryBucket(services = {}) {
  if (!services.__portfolioStore) services.__portfolioStore = {};
  return services.__portfolioStore;
}

async function loadPortfolioData(key, defaultValue = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const data = await services.storageManager.safeRead(key, defaultValue);
      return Array.isArray(defaultValue) ? (Array.isArray(data) ? data : defaultValue) : (data || defaultValue);
    }
  } catch (_) {}
  const bucket = memoryBucket(services);
  if (typeof bucket[key] === 'undefined') bucket[key] = defaultValue;
  return bucket[key];
}

async function savePortfolioData(key, data, services = {}) {
  const clean = utils.sanitize(data);
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, clean);
      return clean;
    }
  } catch (_) {}
  memoryBucket(services)[key] = clean;
  return clean;
}

async function appendPortfolioItem(key, item, limit = 1000, services = {}) {
  const list = await loadPortfolioData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  next.push(utils.sanitize(item));
  await savePortfolioData(key, next.slice(-limit), services);
  return item;
}

function matchFilters(item = {}, filters = {}) {
  for (const [key, value] of Object.entries(filters || {})) {
    if (['limit', 'includeArchived'].includes(key)) continue;
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    if (String(item[key] || '') !== String(value)) return false;
  }
  if (!filters.includeArchived && (item.status === 'archived' || item.archivedAt)) return false;
  return true;
}

async function listPortfolioItems(key, filters = {}, services = {}) {
  const list = await loadPortfolioData(key, [], services);
  const limit = Math.min(Number(filters.limit || 100), 300);
  return utils.stableSortByUpdated(Array.isArray(list) ? list : [])
    .filter(item => matchFilters(item, filters))
    .slice(0, Number.isFinite(limit) ? limit : 100);
}

async function getPortfolioItem(key, id, services = {}) {
  const list = await loadPortfolioData(key, [], services);
  return (Array.isArray(list) ? list : []).find(item => String(item.id) === String(id)) || null;
}

async function upsertPortfolioItem(key, item, services = {}) {
  const list = await loadPortfolioData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const index = next.findIndex(existing => String(existing.id) === String(item.id));
  const value = utils.sanitize({ ...item, updatedAt: item.updatedAt || utils.nowIso() });
  if (index >= 0) next[index] = { ...next[index], ...value };
  else next.push(value);
  await savePortfolioData(key, next, services);
  return index >= 0 ? next[index] : value;
}

async function getOrCreateDefaultPortfolio(workspaceId, userId = '', services = {}) {
  const existing = (await listPortfolioItems(PORTFOLIOS_KEY, { workspaceId, includeArchived: false, limit: 1 }, services))[0];
  if (existing) return existing;
  const now = utils.nowIso();
  const portfolio = {
    id: utils.createId('portfolio'),
    workspaceId,
    userId: String(userId || ''),
    name: 'Default Portfolio',
    description: 'Portfolio otomatis untuk active goals/projects.',
    activeGoalIds: [],
    archivedGoalIds: [],
    priorityMode: 'balanced',
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  await upsertPortfolioItem(PORTFOLIOS_KEY, portfolio, services);
  return portfolio;
}

module.exports = {
  PORTFOLIOS_KEY,
  PORTFOLIO_LINKS_KEY,
  appendPortfolioItem,
  getOrCreateDefaultPortfolio,
  getPortfolioItem,
  listPortfolioItems,
  loadPortfolioData,
  savePortfolioData,
  upsertPortfolioItem
};
