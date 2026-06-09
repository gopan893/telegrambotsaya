'use strict';

const utils = require('./research-utils');
const researchStore = require('./research-store');

async function registerResearchSource(source, services = {}) {
  const entry = {
    id: source.id || utils.createId('src'),
    type: source.type || 'project_doc',
    title: utils.sanitizeText(source.title || 'Untitled Source', 300),
    urlOrPath: utils.sanitizeText(source.urlOrPath || '', 500),
    trustLevel: source.trustLevel || 'medium',
    freshness: source.freshness || 'medium',
    accessMode: source.accessMode || 'local',
    notes: utils.sanitizeText(source.notes || '', 1000),
    createdAt: new Date().toISOString()
  };
  if (!validateResearchSource(entry, services)) return null;
  const sources = await researchStore.loadResearchData('research_sources', [], services);
  sources.push(entry);
  await researchStore.saveResearchData('research_sources', sources, services);
  return entry;
}

async function listResearchSources(filters = {}, services = {}) {
  const sources = await researchStore.loadResearchData('research_sources', [], services);
  let filtered = [...sources];
  if (filters.type) filtered = filtered.filter(s => s.type === filters.type);
  if (filters.trustLevel) filtered = filtered.filter(s => s.trustLevel === filters.trustLevel);
  if (filters.minTrust) {
    const order = { high: 3, medium: 2, low: 1, unknown: 0 };
    filtered = filtered.filter(s => (order[s.trustLevel] || 0) >= (order[filters.minTrust] || 0));
  }
  const limit = Math.min(Number(filters.limit || 50), 200);
  return filtered.slice(-limit).reverse();
}

function validateResearchSource(source, services = {}) {
  if (!source.title || String(source.title).trim().length < 2) return false;
  const validTypes = ['project_doc', 'official_doc', 'paper', 'repo', 'manual_note', 'web_summary'];
  if (!validTypes.includes(source.type)) return false;
  const validTrust = ['high', 'medium', 'low', 'unknown'];
  if (!validTrust.includes(source.trustLevel)) return false;
  return true;
}

function buildSourceCitationBlock(sources = [], services = {}) {
  return sources.map((s, i) => {
    const idx = i + 1;
    const url = s.urlOrPath ? ` (${s.urlOrPath})` : '';
    return `[${idx}] ${s.title}${url} — ${s.trustLevel} trust, ${s.freshness} freshness`;
  }).join('\n') || 'Tidak ada sumber tercatat.';
}

module.exports = { registerResearchSource, listResearchSources, validateResearchSource, buildSourceCitationBlock };
