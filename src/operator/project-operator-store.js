'use strict';

let goals = [];
let plans = [];
let tasks = [];
let idCounter = 1;

const VALID_CATEGORIES = ['coding', 'dashboard', 'integration', 'deployment', 'maintenance', 'research', 'personal_ops', 'learning', 'mixed'];
const VALID_GOAL_STATUSES = ['idea', 'planned', 'in_progress', 'blocked', 'reviewing', 'ready_to_ship', 'shipped', 'archived'];
const VALID_TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'];
const VALID_TASK_TYPES = ['planning', 'coding', 'review', 'testing', 'deployment', 'monitoring', 'documentation', 'repair', 'evaluation'];
const VALID_PLAN_STATUSES = ['draft', 'active', 'completed', 'cancelled'];

function generateId() { return 'op_' + Date.now() + '_' + (idCounter++); }

function createGoal(input) {
  const goal = {
    id: input.id || generateId(),
    workspaceId: input.workspaceId || 'default',
    userId: input.userId || 'default',
    title: input.title || 'Untitled Goal',
    description: input.description || '',
    category: VALID_CATEGORIES.includes(input.category) ? input.category : 'mixed',
    priority: input.priority || 'medium',
    status: 'idea',
    successCriteria: Array.isArray(input.successCriteria) ? input.successCriteria : [],
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    linkedPlans: [],
    linkedTasks: [],
    linkedProposals: [],
    linkedReleases: [],
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  goals.push(goal);
  return goal;
}

function getGoal(id) {
  return goals.find(g => g.id === id) || null;
}

function listGoals(filters) {
  let result = [...goals];
  if (filters) {
    if (filters.workspaceId) result = result.filter(g => g.workspaceId === filters.workspaceId);
    if (filters.userId) result = result.filter(g => g.userId === filters.userId);
    if (filters.status) result = result.filter(g => g.status === filters.status);
    if (filters.category) result = result.filter(g => g.category === filters.category);
    if (filters.limit) result = result.slice(0, filters.limit);
  }
  return result;
}

function updateGoal(id, updates) {
  const goal = getGoal(id);
  if (!goal) return null;
  Object.assign(goal, updates, { updatedAt: new Date().toISOString() });
  return goal;
}

function deleteGoal(id) {
  const idx = goals.findIndex(g => g.id === id);
  if (idx === -1) return false;
  goals.splice(idx, 1);
  return true;
}

function createPlan(input) {
  const plan = {
    id: input.id || generateId(),
    goalId: input.goalId || '',
    workspaceId: input.workspaceId || 'default',
    title: input.title || 'Untitled Plan',
    summary: input.summary || '',
    milestones: Array.isArray(input.milestones) ? input.milestones : [],
    phases: Array.isArray(input.phases) ? input.phases : [],
    dependencies: Array.isArray(input.dependencies) ? input.dependencies : [],
    risks: Array.isArray(input.risks) ? input.risks : [],
    estimatedCost: input.estimatedCost || null,
    evaluationRequired: input.evaluationRequired !== false,
    status: VALID_PLAN_STATUSES.includes(input.status) ? input.status : 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  plans.push(plan);
  return plan;
}

function getPlan(id) {
  return plans.find(p => p.id === id) || null;
}

function listPlans(goalId) {
  if (goalId) return plans.filter(p => p.goalId === goalId);
  return [...plans];
}

function updatePlan(id, updates) {
  const plan = getPlan(id);
  if (!plan) return null;
  Object.assign(plan, updates, { updatedAt: new Date().toISOString() });
  return plan;
}

function createTask(input) {
  const task = {
    id: input.id || generateId(),
    goalId: input.goalId || '',
    planId: input.planId || '',
    title: input.title || 'Untitled Task',
    description: input.description || '',
    type: VALID_TASK_TYPES.includes(input.type) ? input.type : 'planning',
    assignedAgent: input.assignedAgent || null,
    status: 'todo',
    riskLevel: input.riskLevel || 'low',
    requiresApproval: input.requiresApproval !== false,
    linkedCodingPlanId: input.linkedCodingPlanId || null,
    linkedProposalId: input.linkedProposalId || null,
    priority: input.priority || 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tasks.push(task);
  return task;
}

function getTask(id) {
  return tasks.find(t => t.id === id) || null;
}

function listTasks(filters) {
  let result = [...tasks];
  if (filters) {
    if (filters.goalId) result = result.filter(t => t.goalId === filters.goalId);
    if (filters.planId) result = result.filter(t => t.planId === filters.planId);
    if (filters.status) result = result.filter(t => t.status === filters.status);
    if (filters.assignedAgent) result = result.filter(t => t.assignedAgent === filters.assignedAgent);
    if (filters.type) result = result.filter(t => t.type === filters.type);
    if (filters.limit) result = result.slice(0, filters.limit);
  }
  result.sort((a, b) => a.createdAt > b.createdAt ? -1 : 1);
  return result;
}

function updateTask(id, updates) {
  const task = getTask(id);
  if (!task) return null;
  Object.assign(task, updates, { updatedAt: new Date().toISOString() });
  return task;
}

function deleteAll() {
  goals = [];
  plans = [];
  tasks = [];
}

module.exports = {
  createGoal, getGoal, listGoals, updateGoal, deleteGoal,
  createPlan, getPlan, listPlans, updatePlan,
  createTask, getTask, listTasks, updateTask,
  deleteAll,
  VALID_CATEGORIES, VALID_GOAL_STATUSES, VALID_TASK_STATUSES, VALID_TASK_TYPES, VALID_PLAN_STATUSES
};
