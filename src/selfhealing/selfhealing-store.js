'use strict';

const utils = require('./selfhealing-utils');

const STORAGE_KEYS = {
  GUARDS: 'regression_guards',
  RUNS: 'regression_guard_runs',
  REPAIR_PLANS: 'selfhealing_repair_plans',
  REPAIR_PROMPTS: 'selfhealing_repair_prompts',
  PROPOSALS: 'selfhealing_proposals'
};

function createStore(storageManager) {
  async function getCollection(key) {
    if (!storageManager) return [];
    try {
      const raw = await storageManager.get(key);
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  async function saveCollection(key, data) {
    if (!storageManager) return false;
    try {
      await storageManager.set(key, data);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function getGuards() {
    return getCollection(STORAGE_KEYS.GUARDS);
  }

  async function saveGuards(guards) {
    return saveCollection(STORAGE_KEYS.GUARDS, guards);
  }

  async function getGuard(id) {
    const guards = await getGuards();
    return guards.find(g => g.id === id) || null;
  }

  async function upsertGuard(guard) {
    const guards = await getGuards();
    const idx = guards.findIndex(g => g.id === guard.id);
    if (idx >= 0) {
      guards[idx] = { ...guards[idx], ...guard, updatedAt: utils.nowISO() };
    } else {
      guards.push({ ...guard, id: guard.id || utils.generateId('gd'), createdAt: utils.nowISO(), updatedAt: utils.nowISO() });
    }
    await saveGuards(guards);
    return guard;
  }

  async function getRuns(filter) {
    const runs = await getCollection(STORAGE_KEYS.RUNS);
    if (!filter) return runs;
    return runs.filter(r => {
      for (const key of Object.keys(filter)) {
        if (r[key] !== filter[key]) return false;
      }
      return true;
    });
  }

  async function saveRun(run) {
    const runs = await getCollection(STORAGE_KEYS.RUNS);
    runs.push({ ...run, id: run.id || utils.generateId('run'), createdAt: utils.nowISO() });
    await saveCollection(STORAGE_KEYS.RUNS, runs);
    return run;
  }

  async function getRepairPlans(filter) {
    const plans = await getCollection(STORAGE_KEYS.REPAIR_PLANS);
    if (!filter) return plans;
    return plans.filter(p => {
      for (const key of Object.keys(filter)) {
        if (p[key] !== filter[key]) return false;
      }
      return true;
    });
  }

  async function getRepairPlan(id) {
    const plans = await getRepairPlans();
    return plans.find(p => p.id === id) || null;
  }

  async function saveRepairPlan(plan) {
    const plans = await getRepairPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = { ...plans[idx], ...plan, updatedAt: utils.nowISO() };
    } else {
      plans.push({ ...plan, id: plan.id || utils.generateId('rp'), createdAt: utils.nowISO(), updatedAt: utils.nowISO() });
    }
    await saveCollection(STORAGE_KEYS.REPAIR_PLANS, plans);
    return plan;
  }

  async function updateRepairPlanStatus(id, status) {
    const plan = await getRepairPlan(id);
    if (!plan) return null;
    plan.status = status;
    plan.updatedAt = utils.nowISO();
    await saveRepairPlan(plan);
    return plan;
  }

  async function savePrompt(prompt) {
    const prompts = await getCollection(STORAGE_KEYS.REPAIR_PROMPTS);
    prompts.push({ ...prompt, id: prompt.id || utils.generateId('pm'), createdAt: utils.nowISO() });
    await saveCollection(STORAGE_KEYS.REPAIR_PROMPTS, prompts);
    return prompt;
  }

  async function saveProposal(proposal) {
    const proposals = await getCollection(STORAGE_KEYS.PROPOSALS);
    proposals.push({ ...proposal, id: proposal.id || utils.generateId('pr'), createdAt: utils.nowISO() });
    await saveCollection(STORAGE_KEYS.PROPOSALS, proposals);
    return proposal;
  }

  return {
    STORAGE_KEYS,
    getGuards,
    saveGuards,
    getGuard,
    upsertGuard,
    getRuns,
    saveRun,
    getRepairPlans,
    getRepairPlan,
    saveRepairPlan,
    updateRepairPlanStatus,
    savePrompt,
    saveProposal
  };
}

module.exports = { createStore, STORAGE_KEYS };
