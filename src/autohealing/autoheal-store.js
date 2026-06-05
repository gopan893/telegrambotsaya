'use strict';

const utils = require('./autoheal-utils');

const KEYS = { ACTIONS: 'autoheal_actions', RUNS: 'autoheal_runs', BLOCKS: 'autoheal_blocks', PROPOSALS: 'autoheal_proposals' };

function createStore(storageManager) {
  async function coll(key) {
    if (!storageManager) return [];
    try {
      const r = storageManager.safeRead
        ? await storageManager.safeRead(key, [])
        : storageManager.loadData
          ? await storageManager.loadData(key, [])
          : storageManager.get
            ? await storageManager.get(key)
            : [];
      return Array.isArray(r) ? r : [];
    } catch (_) { return []; }
  }
  async function save(key, data) {
    if (!storageManager) return false;
    try {
      if (storageManager.safeWrite) await storageManager.safeWrite(key, data);
      else if (storageManager.saveData) await storageManager.saveData(key, data);
      else if (storageManager.set) await storageManager.set(key, data);
      else return false;
      return true;
    } catch (_) { return false; }
  }

  async function getActions() { return coll(KEYS.ACTIONS); }
  async function saveActions(a) { return save(KEYS.ACTIONS, a); }
  async function getAction(id) { const a = await getActions(); return a.find(x => x.id === id) || null; }
  async function upsertAction(action) {
    const list = await getActions(); const idx = list.findIndex(x => x.id === action.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...action, updatedAt: utils.nowISO() };
    else list.push({ ...action, id: action.id || utils.generateId('ah'), createdAt: utils.nowISO(), updatedAt: utils.nowISO() });
    await saveActions(list); return action;
  }

  async function getRuns(filter) {
    const list = await coll(KEYS.RUNS); if (!filter) return list;
    return list.filter(r => { for (const k of Object.keys(filter)) { if (r[k] !== filter[k]) return false; } return true; });
  }
  async function saveRun(run) {
    const list = await coll(KEYS.RUNS);
    if (!run.id) run.id = utils.generateId('ahr');
    if (!run.createdAt) run.createdAt = utils.nowISO();
    list.push(run);
    await save(KEYS.RUNS, list); return run;
  }

  async function saveProposal(p) {
    const list = await coll(KEYS.PROPOSALS);
    list.push({ ...p, id: p.id || utils.generateId('ahp'), createdAt: utils.nowISO() });
    await save(KEYS.PROPOSALS, list); return p;
  }

  async function getProposals(filter) {
    const list = await coll(KEYS.PROPOSALS);
    if (!filter) return list;
    return list.filter(item => {
      for (const key of Object.keys(filter)) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
  }

  return { KEYS, getActions, saveActions, getAction, upsertAction, getRuns, saveRun, saveProposal, getProposals };
}

module.exports = { createStore, KEYS };
