'use strict';

const utils = require('./cicd-utils');

const KEYS = { RELEASES: 'cicd_releases', PROPOSALS: 'cicd_proposals', PIPELINES: 'cicd_pipelines' };

function createStore(storageManager) {
  async function coll(key) {
    if (!storageManager) return [];
    try { const r = await storageManager.get(key); return Array.isArray(r) ? r : []; } catch (_) { return []; }
  }
  async function save(key, data) {
    if (!storageManager) return false;
    try { await storageManager.set(key, data); return true; } catch (_) { return false; }
  }

  async function getReleases() { return coll(KEYS.RELEASES); }
  async function addRelease(r) {
    const list = await getReleases();
    list.push({ ...r, id: r.id || utils.generateId('rel'), createdAt: utils.nowISO() });
    await save(KEYS.RELEASES, list);
    return r;
  }

  async function getProposals() { return coll(KEYS.PROPOSALS); }
  async function saveProposal(p) {
    const list = await getProposals();
    list.push({ ...p, id: p.id || utils.generateId('cicdp'), createdAt: utils.nowISO() });
    await save(KEYS.PROPOSALS, list);
    return p;
  }

  async function getPipelines() { return coll(KEYS.PIPELINES); }
  async function savePipeline(p) {
    const list = await getPipelines();
    list.push({ ...p, id: p.id || utils.generateId('pipe'), createdAt: utils.nowISO() });
    await save(KEYS.PIPELINES, list);
    return p;
  }

  return { KEYS, getReleases, addRelease, getProposals, saveProposal, getPipelines, savePipeline };
}

module.exports = { createStore, KEYS };
