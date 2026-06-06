'use strict';

const store = require('./project-operator-store');

const CATEGORY_KEYWORDS = {
  coding: ['coding', 'code', 'implementasi', 'program', 'feature', 'fitur', 'function', 'api', 'endpoint', 'buat fitur'],
  dashboard: ['dashboard', 'ui', 'frontend', 'html', 'css', 'javascript', 'tab', 'menu'],
  integration: ['integrasi', 'integration', 'github', 'api eksternal', 'webhook', 'connector', 'google', 'gmail', 'calendar'],
  deployment: ['deploy', 'release', 'rollback', 'render', 'production', 'ci/cd', 'pipeline', 'push'],
  maintenance: ['maintenance', 'perbaiki', 'fix', 'bug', 'error', 'crash', 'stabilkan', 'stabil'],
  research: ['riset', 'research', 'analisa', 'analisis', 'evaluasi', 'studi'],
  personal_ops: ['pribadi', 'personal', 'jadwal', 'schedule', 'reminder', 'note', 'catatan'],
  learning: ['belajar', 'learn', 'tutorial', 'course', 'training', 'materi']
};

function analyzeProjectGoal(input) {
  if (!input || !input.title) return { goal: null, analysis: { error: 'no_input' } };
  const text = (input.title + ' ' + (input.description || '')).toLowerCase();
  const category = classifyProjectGoal(text);
  const successCriteria = extractSuccessCriteria(input);
  const constraints = extractConstraints(input);
  const risk = detectGoalRisk(input);
  const goal = store.createGoal({
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: input.title,
    description: input.description || '',
    category,
    priority: input.priority || 'medium',
    successCriteria,
    constraints,
    metadata: { risk, analysisSource: 'project-goal-analyzer' }
  });
  return {
    goal,
    analysis: { category, successCriteria, constraints, risk, summary: buildGoalSummary(goal) }
  };
}

function classifyProjectGoal(text) {
  const clean = String(text || '').toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = keywords.filter(k => clean.includes(k)).length;
  }
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (top[0][1] === 0) return 'mixed';
  const highest = top[0][1];
  const tied = top.filter(([, s]) => s === highest);
  if (tied.length > 1) return 'mixed';
  return tied[0][0];
}

function extractSuccessCriteria(input) {
  const criteria = [];
  const text = (input.title + ' ' + (input.description || '')).toLowerCase();
  if (text.includes('stabil') || text.includes('stabilkan')) criteria.push('System stable');
  if (text.includes('deploy') || text.includes('production')) criteria.push('Deploy success');
  if (text.includes('test')) criteria.push('Tests pass');
  if (text.includes('aman') || text.includes('security') || text.includes('secret')) criteria.push('No secret leak');
  if (text.includes('approval')) criteria.push('Approval boundary intact');
  if (input.successCriteria) criteria.push(...input.successCriteria);
  return criteria.length > 0 ? criteria : ['Goal completed successfully'];
}

function extractConstraints(input) {
  const constraints = [];
  const text = (input.title + ' ' + (input.description || '')).toLowerCase();
  if (text.includes('aman') || text.includes('safety')) constraints.push('No safety bypass');
  if (text.includes('tanpa') || text.includes('jangan')) constraints.push('No direct dangerous action');
  if (input.constraints) constraints.push(...input.constraints);
  return constraints;
}

function detectGoalRisk(input) {
  const text = (input.title + ' ' + (input.description || '')).toLowerCase();
  const highRisk = ['push', 'deploy', 'rollback', 'delete', 'hapus', 'write eksternal', 'github write', 'external', 'danger'];
  const mediumRisk = ['integrasi', 'integration', 'api baru', 'new api', 'coding besar', 'large refactor'];
  let score = 0;
  for (const w of highRisk) { if (text.includes(w)) score += 2; }
  for (const w of mediumRisk) { if (text.includes(w)) score += 1; }
  if (score >= 3) return { level: 'high', score, requiresApproval: true };
  if (score >= 1) return { level: 'medium', score, requiresApproval: false };
  return { level: 'low', score: 0, requiresApproval: false };
}

function buildGoalSummary(goal) {
  if (!goal) return 'No goal.';
  return `Goal: ${goal.title} | Status: ${goal.status} | Category: ${goal.category} | Priority: ${goal.priority} | Criteria: ${(goal.successCriteria || []).join(', ')}`;
}

module.exports = {
  analyzeProjectGoal,
  classifyProjectGoal,
  extractSuccessCriteria,
  extractConstraints,
  detectGoalRisk,
  buildGoalSummary
};
