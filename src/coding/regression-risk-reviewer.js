'use strict';

const { STORAGE_KEYS } = require('./coding-workspace-store');
const { createCompatibilityChecklist } = require('./code-change-planner');

function checkCoderFeasibility(plan) {
  const issues = [];
  if (!plan.proposedFiles || plan.proposedFiles.length === 0) {
    issues.push('No proposed files identified');
  }
  if (!plan.implementationSteps || plan.implementationSteps.length === 0) {
    issues.push('No implementation steps defined');
  }
  if (plan.proposedFiles && plan.proposedFiles.length > 15) {
    issues.push('Too many files affected — consider splitting into smaller changes');
  }
  return {
    agent: 'Coder',
    severity: issues.length > 0 ? 'warning' : 'ok',
    issues
  };
}

function checkRoadmapFit(plan) {
  const issues = [];
  if (!plan.title) issues.push('Plan has no title');
  if (!plan.requestSummary) issues.push('Plan has no request summary');
  if (plan.status === 'pending_approval' && !plan.requiresApproval) {
    issues.push('Plan pending approval but requiresApproval not set');
  }
  return {
    agent: 'Planner',
    severity: issues.length > 0 ? 'warning' : 'ok',
    issues
  };
}

function checkRegressions(plan) {
  const issues = [];
  if (plan.affectedAreas) {
    const areas = plan.affectedAreas;
    if (areas.some(a => a.includes('bot') || a.includes('webhook'))) {
      issues.push('May affect Telegram bot message handling');
    }
    if (areas.some(a => a.includes('dashboard') || a.includes('public'))) {
      issues.push('May break dashboard UI or PWA');
    }
    if (areas.some(a => a.includes('storage') || a.includes('database'))) {
      issues.push('May break data persistence or migrations');
    }
    if (areas.some(a => a.includes('conversation') || a.includes('memory'))) {
      issues.push('May affect conversation continuity or memory relevance');
    }
    if (areas.some(a => a.includes('evaluation') || a.includes('governance'))) {
      issues.push('May weaken safety gates or evaluation checks');
    }
    if (areas.some(a => a.includes('interactions') || a.includes('ux'))) {
      issues.push('May affect inline keyboards or interactive menus');
    }
  }
  return {
    agent: 'Critic',
    severity: issues.length >= 3 ? 'warning' : 'ok',
    issues
  };
}

function checkSecurityRisk(plan) {
  const issues = [];
  const text = `${plan.title || ''} ${plan.requestSummary || ''}`.toLowerCase();

  if (/token|password|secret|api.key|database_url/i.test(text)) {
    issues.push('Contains secret/token reference ensure no secrets in output');
  }
  if (/bypass|skip.*approval|auto.approve/i.test(text)) {
    issues.push('May bypass approval mechanism');
  }
  if (/exec\(|child_process|spawn\(|shell/i.test(text)) {
    issues.push('Contains shell execution pattern');
  }
  if (/delete.*all|drop\s+table|truncate|rm\s+-rf/i.test(text)) {
    issues.push('Contains destructive operation');
  }
  if (/direct.*push|direct.*commit|auto.*merge|force.*push/i.test(text)) {
    issues.push('May write directly to external system without approval');
  }

  return {
    agent: 'Security',
    severity: issues.length > 0 ? 'blocker' : 'ok',
    issues
  };
}

function checkApprovalBoundary(plan) {
  const issues = [];
  if (plan.riskLevel === 'critical') {
    issues.push('Critical risk level requires manual executor approval');
  }
  if (plan.category === 'deployment_issue') {
    issues.push('Deployment changes require executor approval');
  }
  if (plan.category === 'security_issue') {
    issues.push('Security changes require Security + Executor approval');
  }
  return {
    agent: 'Executor',
    severity: issues.length > 0 ? 'warning' : 'ok',
    issues
  };
}

function reviewCodingPlanRisk(plan, services = {}) {
  if (!plan) return null;

  const coderReview = checkCoderFeasibility(plan);
  const plannerReview = checkRoadmapFit(plan);
  const criticReview = checkRegressions(plan);
  const securityReview = checkSecurityRisk(plan);
  const executorReview = checkApprovalBoundary(plan);

  const reviews = [coderReview, plannerReview, criticReview, securityReview, executorReview];
  const blockers = reviews.filter(r => r.severity === 'blocker');
  const warnings = reviews.filter(r => r.severity === 'warning');

  return {
    planId: plan.id,
    reviewers: ['Coder', 'Planner', 'Critic', 'Security', 'Executor'],
    reviews,
    blockers,
    warnings,
    hasBlockers: blockers.length > 0,
    hasWarnings: warnings.length > 0,
    overallSeverity: blockers.length > 0 ? 'blocker' : warnings.length > 0 ? 'warning' : 'ok',
    canProceed: blockers.length === 0
  };
}

function detectRegressionRisk(plan, services = {}) {
  if (!plan) return { regressionRisk: 'none', reasons: [] };

  const risks = [];
  if (plan.affectedAreas) {
    for (const area of plan.affectedAreas) {
      if (area.includes('bot') || area.includes('webhook')) {
        risks.push('May affect Telegram bot message handling');
      }
      if (area.includes('dashboard') || area.includes('public')) {
        risks.push('May break dashboard UI or PWA');
      }
      if (area.includes('storage') || area.includes('database')) {
        risks.push('May break data persistence or migrations');
      }
      if (area.includes('conversation') || area.includes('memory')) {
        risks.push('May affect conversation continuity or memory relevance');
      }
      if (area.includes('evaluation') || area.includes('governance')) {
        risks.push('May weaken safety gates or evaluation checks');
      }
      if (area.includes('interactions') || area.includes('ux')) {
        risks.push('May affect inline keyboards or interactive menus');
      }
    }
  }

  const riskLevel = risks.length >= 3 ? 'high' : risks.length >= 1 ? 'medium' : 'low';
  return {
    regressionRisk: riskLevel,
    reasons: risks,
    affectedAreas: plan.affectedAreas || [],
    recommendation: riskLevel === 'high'
      ? 'Split into smaller incremental changes'
      : 'Proceed with caution and run smoke tests'
  };
}

function detectSecurityRisk(plan, services = {}) {
  if (!plan) return { securityRisk: 'low', issues: [] };

  const issues = [];
  const text = `${plan.title || ''} ${plan.requestSummary || ''}`.toLowerCase();

  if (/token|password|secret|api.key|database_url/i.test(text)) {
    issues.push({ type: 'secret_reference', desc: 'Contains secret/token reference' });
  }
  if (/bypass|skip.*approval|auto.approve/i.test(text)) {
    issues.push({ type: 'approval_bypass', desc: 'May bypass approval mechanism' });
  }
  if (/exec\(|child_process|spawn\(|shell/i.test(text)) {
    issues.push({ type: 'shell_execution', desc: 'Contains shell execution pattern' });
  }
  if (/delete.*all|drop\s+table|truncate|rm\s+-rf|hapus\s+semua|hapus.*semua/i.test(text)) {
    issues.push({ type: 'destructive_operation', desc: 'Contains destructive operation' });
  }
  if (/direct.*push|direct.*commit|auto.*merge|force.*push/i.test(text)) {
    issues.push({ type: 'external_write', desc: 'May write directly to external system' });
  }

  const riskLevel = issues.length >= 1 ? 'high' : 'low';
  return {
    securityRisk: riskLevel,
    issues,
    recommendation: riskLevel !== 'low' ? 'Review security implications before proceeding' : 'No security concerns detected'
  };
}

function detectCompatibilityRisk(plan, services = {}) {
  if (!plan) return { compatibilityRisk: 'low', checks: [] };

  const checks = [];
  const text = `${plan.title || ''} ${plan.requestSummary || ''}`.toLowerCase();

  if (/react/i.test(text)) {
    checks.push({ check: 'react', status: 'warning', desc: 'React detected but project constraint may prohibit it' });
  }
  if (/typescript|\.tsx?\b/i.test(text)) {
    checks.push({ check: 'typescript', status: 'warning', desc: 'TypeScript detected but project uses CommonJS' });
  }
  if (/next\.js|nextjs/i.test(text)) {
    checks.push({ check: 'nextjs', status: 'warning', desc: 'Next.js detected but project uses vanilla HTML' });
  }
  if (/vue|nuxt|svelte/i.test(text)) {
    checks.push({ check: 'frontend_framework', status: 'warning', desc: 'Frontend framework detected but project uses vanilla JS' });
  }

  const riskLevel = checks.length >= 2 ? 'high' : checks.length >= 1 ? 'medium' : 'low';
  return {
    compatibilityRisk: riskLevel,
    checks,
    recommendation: riskLevel !== 'low' ? 'Verify compatibility with project constraints' : 'No compatibility risks detected'
  };
}

function buildRiskReviewSummary(plan, services = {}) {
  if (!plan) return null;

  const regression = detectRegressionRisk(plan, services);
  const security = detectSecurityRisk(plan, services);
  const compatibility = detectCompatibilityRisk(plan, services);

  const allRisks = [regression.regressionRisk, security.securityRisk, compatibility.compatibilityRisk];
  const overallRisk = allRisks.includes('critical') ? 'critical' :
    allRisks.includes('high') ? 'high' :
    allRisks.includes('medium') ? 'medium' : 'low';

  return {
    planId: plan.id,
    overallRisk,
    regression,
    security,
    compatibility,
    requiresApproval: overallRisk === 'high' || overallRisk === 'critical',
    canProceed: overallRisk !== 'critical'
  };
}

module.exports = {
  reviewCodingPlanRisk,
  detectRegressionRisk,
  detectSecurityRisk,
  detectCompatibilityRisk,
  buildRiskReviewSummary
};
