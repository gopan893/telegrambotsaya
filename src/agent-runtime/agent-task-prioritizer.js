'use strict';

const loadController = require('./agent-load-controller');
const utils = require('./agent-runtime-utils');

function prioritizeTask(task = {}, context = {}, services = {}) {
  const priority = loadController.classifyPriority(task, services);
  const domain = loadController.classifyDomain(task, services);
  const urgency = assessUrgency(task, context, services);
  const impact = assessImpact(task, context, services);
  const effort = assessEffort(task, services);
  const score = computePriorityScore(priority, urgency, impact, effort);
  return {
    id: utils.createId('prior'),
    taskId: task.id || utils.createId('task'),
    priority,
    domain,
    urgency,
    impact,
    effort,
    score,
    recommendedAgent: suggestAgent(domain, priority, services),
    scheduledAt: new Date().toISOString()
  };
}

function assessUrgency(task = {}, context = {}, services = {}) {
  const text = String(task.input || task.description || '').toLowerCase();
  if (/urgent|asap|segera|immediate|critical|incident/i.test(text)) return 'high';
  if (/soon|nanti|next|follow.?up/i.test(text)) return 'medium';
  return 'low';
}

function assessImpact(task = {}, context = {}, services = {}) {
  const text = String(task.input || task.description || '').toLowerCase();
  if (/security|privacy|incident|data.?loss|production/i.test(text)) return 'high';
  if (/coding|deploy|release|feature|major/i.test(text)) return 'medium';
  return 'low';
}

function assessEffort(task = {}, services = {}) {
  const text = String(task.input || task.description || '').toLowerCase();
  const words = text.split(/\s+/).length;
  if (words > 80 || /heavy|complex|full|complete/i.test(text)) return 'high';
  if (words > 30 || /medium|moderate/i.test(text)) return 'medium';
  return 'low';
}

function computePriorityScore(priority, urgency, impact, effort) {
  const pMap = { P0: 100, P1: 80, P2: 60, P3: 40, P4: 20 };
  const uMap = { high: 30, medium: 15, low: 5 };
  const iMap = { high: 30, medium: 15, low: 5 };
  const eMap = { high: -10, medium: 0, low: 10 };
  return (pMap[priority] ?? 40) + (uMap[urgency] ?? 5) + (iMap[impact] ?? 5) + (eMap[effort] ?? 0);
}

function suggestAgent(domain, priority, services = {}) {
  if (domain === 'security' || domain === 'privacy') return 'security';
  if (domain === 'coding') return 'coder';
  if (domain === 'ops') return 'ops';
  if (domain === 'research') return 'researcher';
  if (domain === 'lifeos') return 'orchestrator';
  if (priority === 'P0' || priority === 'P1') return 'orchestrator';
  return 'orchestrator';
}

function sortByPriority(items = []) {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function filterByPriority(items = [], minPriority = 'P3') {
  const minNum = loadController.PRIORITY_LEVELS[minPriority] ?? 4;
  return items.filter(item => {
    const pNum = loadController.PRIORITY_LEVELS[item.priority] ?? 4;
    return pNum <= minNum;
  });
}

module.exports = { prioritizeTask, assessUrgency, assessImpact, assessEffort, computePriorityScore, suggestAgent, sortByPriority, filterByPriority };
