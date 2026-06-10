'use strict';

const store = require('./agent-runtime-store');
const utils = require('./agent-runtime-utils');

const DEFAULT_COUNCIL_BUDGET = { maxAgentsPerSession: 6, maxOpinions: 12, maxCritiques: 8, estimatedCostPerAgent: 0.002 };

function estimateCouncilCost(session = {}, services = {}) {
  const agents = Array.isArray(session.selectedAgents) ? session.selectedAgents.length : 0;
  const budget = services.councilBudget || DEFAULT_COUNCIL_BUDGET;
  const baseCost = agents * (budget.estimatedCostPerAgent || 0.002);
  const modeMultiplier = session.mode === 'debate' ? 1.5 : 1.0;
  return {
    agents,
    mode: session.mode || 'normal',
    estimatedCost: +(baseCost * modeMultiplier).toFixed(6),
    withinBudget: agents <= (budget.maxAgentsPerSession || 6),
    budget
  };
}

function shouldThrottleCouncil(session = {}, recentSessions = [], services = {}) {
  const budget = services.councilBudget || DEFAULT_COUNCIL_BUDGET;
  const last5min = recentSessions.filter(s => {
    const age = Date.now() - new Date(s.createdAt || 0).getTime();
    return age < 5 * 60 * 1000;
  });
  const costLast5min = last5min.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
  const maxBudget5min = services.maxCouncilCostPer5Min || 0.02;
  if (costLast5min >= maxBudget5min) {
    return { throttle: true, reason: 'budget_exceeded', costLast5min: +costLast5min.toFixed(6), maxBudget: maxBudget5min };
  }
  if (last5min.length >= (budget.maxSessionsPer5Min || 10)) {
    return { throttle: true, reason: 'rate_exceeded', sessionsLast5Min: last5min.length };
  }
  return { throttle: false };
}

function limitCouncilAgents(selectedAgents = [], services = {}) {
  const budget = services.councilBudget || DEFAULT_COUNCIL_BUDGET;
  const max = budget.maxAgentsPerSession || 6;
  if (selectedAgents.length <= max) return selectedAgents;
  const prioritized = selectedAgents.filter(a => /security|critic|orchestrator/.test(a));
  const rest = selectedAgents.filter(a => !/security|critic|orchestrator/.test(a));
  const result = [...prioritized, ...rest].slice(0, max);
  return result;
}

function limitOpinions(opinions = [], services = {}) {
  const budget = services.councilBudget || DEFAULT_COUNCIL_BUDGET;
  return opinions.slice(0, budget.maxOpinions || 12);
}

function limitCritiques(critiques = [], services = {}) {
  const budget = services.councilBudget || DEFAULT_COUNCIL_BUDGET;
  return critiques.slice(0, budget.maxCritiques || 8);
}

async function recordCouncilCost(sessionId, cost, services = {}) {
  const record = { id: utils.createId('ccost'), sessionId, ...cost, recordedAt: new Date().toISOString() };
  return store.addRecord('councilCosts', record, services);
}

async function getCouncilCostSummary(services = {}) {
  const records = await store.getRecords('councilCosts', null, services);
  const totalCost = records.reduce((s, r) => s + (r.estimatedCost || 0), 0);
  return { totalSessions: records.length, totalCost: +totalCost.toFixed(6), avgCost: records.length ? +(totalCost / records.length).toFixed(6) : 0 };
}

module.exports = { estimateCouncilCost, shouldThrottleCouncil, limitCouncilAgents, limitOpinions, limitCritiques, recordCouncilCost, getCouncilCostSummary, DEFAULT_COUNCIL_BUDGET };
