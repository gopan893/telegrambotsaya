'use strict';

const store = require('./research-store');
const utils = require('./research-utils');

async function createResearchTask(input, services = {}) {
  const { id, title, query, category, sourceMode, sensitivity, riskLevel } = input;
  const task = {
    id: id || utils.createId('rtask'),
    workspaceId: services.workspaceId || 'default',
    userId: services.userId || 'unknown',
    title: utils.sanitizeText(title || 'Research Task', 200),
    query: utils.sanitizeText(query || '', 2000),
    category: category || 'general',
    status: 'draft',
    sourceMode: sourceMode || 'project_docs',
    sensitivity: sensitivity || 'low',
    riskLevel: riskLevel || 'low',
    sources: [],
    notes: [],
    comparison: null,
    implementationPlan: null,
    generatedPrompts: [],
    proposalIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const tasks = await store.loadResearchData('research_tasks', [], services);
  tasks.push(task);
  await store.saveResearchData('research_tasks', tasks, services);
  return task;
}

async function getResearchTask(taskId, services = {}) {
  const tasks = await store.loadResearchData('research_tasks', [], services);
  return tasks.find(t => t.id === taskId) || null;
}

async function updateResearchTask(taskId, updates, services = {}) {
  const tasks = await store.loadResearchData('research_tasks', [], services);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
  await store.saveResearchData('research_tasks', tasks, services);
  return tasks[idx];
}

async function listResearchTasks(filters = {}, services = {}) {
  const tasks = await store.loadResearchData('research_tasks', [], services);
  let filtered = [...tasks];
  if (filters.status) filtered = filtered.filter(t => t.status === filters.status);
  if (filters.category) filtered = filtered.filter(t => t.category === filters.category);
  if (filters.workspaceId) filtered = filtered.filter(t => t.workspaceId === filters.workspaceId);
  const limit = Math.min(Number(filters.limit || 50), 200);
  return filtered.slice(-limit).reverse();
}

module.exports = { createResearchTask, getResearchTask, updateResearchTask, listResearchTasks };
