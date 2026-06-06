'use strict';

const store = require('./project-operator-store');

function createOperatorPlan(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { ok: false, error: 'Goal not found' };
  const roadmap = createRoadmapFromGoal(goal);
  const plan = store.createPlan({
    goalId: goal.id,
    workspaceId: goal.workspaceId,
    title: `Plan: ${goal.title}`,
    summary: `Delivery plan for ${goal.title}. Category: ${goal.category}. ${goal.successCriteria.length} success criteria.`,
    milestones: roadmap.milestones,
    phases: roadmap.phases,
    dependencies: roadmap.dependencies,
    risks: roadmap.risks,
    estimatedCost: roadmap.estimatedCost || null,
    evaluationRequired: goal.metadata?.risk?.level === 'high' || roadmap.highRisk,
    status: 'draft'
  });
  store.updateGoal(goalId, { linkedPlans: [...(goal.linkedPlans || []), plan.id], status: 'planned' });
  return { ok: true, plan, roadmap };
}

function createRoadmapFromGoal(goal) {
  const milestones = [];
  const phases = [];
  const risks = [];
  const dependencies = [];
  const cat = goal.category;
  let highRisk = false;

  if (cat === 'coding' || cat === 'mixed') {
    phases.push({ name: 'Analysis & Planning', order: 1 });
    phases.push({ name: 'Implementation', order: 2 });
    phases.push({ name: 'Review & Testing', order: 3 });
    phases.push({ name: 'Integration', order: 4 });
    milestones.push({ name: 'Code Complete', phase: 2 });
    milestones.push({ name: 'Tests Pass', phase: 3 });
    dependencies.push({ from: 'Analysis & Planning', to: 'Implementation' });
  }
  if (cat === 'deployment' || cat === 'mixed') {
    phases.push({ name: 'Release Preparation', order: 5 });
    phases.push({ name: 'Deploy & Monitor', order: 6 });
    milestones.push({ name: 'Deployed', phase: 6 });
    risks.push({ description: 'Deploy may break existing features', severity: 'high' });
    highRisk = true;
  }
  if (cat === 'integration' || cat === 'mixed') {
    phases.push({ name: 'Integration Setup', order: 3.5 });
    phases.push({ name: 'Integration Testing', order: 4.5 });
    milestones.push({ name: 'Integration Verified', phase: 4.5 });
    risks.push({ description: 'External API changes may break integration', severity: 'medium' });
  }
  if (cat === 'dashboard') {
    phases.push({ name: 'UI Design', order: 1 });
    phases.push({ name: 'Implementation', order: 2 });
    phases.push({ name: 'Testing', order: 3 });
    milestones.push({ name: 'UI Complete', phase: 2 });
  }
  if (cat === 'maintenance' || cat === 'repair') {
    phases.push({ name: 'Diagnosis', order: 1 });
    phases.push({ name: 'Fix', order: 2 });
    phases.push({ name: 'Verification', order: 3 });
    milestones.push({ name: 'Fixed', phase: 2 });
  }

  phases.sort((a, b) => a.order - b.order);
  return { milestones, phases, dependencies, risks, highRisk, estimatedCost: null };
}

function createSprintPlan(goal, options) {
  if (!goal) return { ok: false, error: 'No goal' };
  const sprintDuration = options?.duration || 'weekly';
  const sprintName = options?.name || `Sprint ${new Date().toISOString().split('T')[0]}`;
  const plan = store.createPlan({
    goalId: goal.id,
    workspaceId: goal.workspaceId,
    title: sprintName,
    summary: `Sprint for ${goal.title}`,
    milestones: [{ name: 'Sprint Complete', phase: 1 }],
    phases: [{ name: sprintName, order: 1 }],
    status: 'draft'
  });
  return { ok: true, plan, sprintDuration };
}

function createMilestones(goal) {
  if (!goal) return [];
  const roadmap = createRoadmapFromGoal(goal);
  return roadmap.milestones;
}

function updateOperatorPlan(planId, update) {
  const plan = store.updatePlan(planId, update);
  if (!plan) return { ok: false, error: 'Plan not found' };
  return { ok: true, plan };
}

module.exports = {
  createOperatorPlan,
  createRoadmapFromGoal,
  createSprintPlan,
  createMilestones,
  updateOperatorPlan
};
