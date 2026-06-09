'use strict';

const utils = require('./docs-intel-utils');

async function createDocsUpdatePlan(gapReport = {}, services = {}) {
  const gaps = gapReport.gaps || [];
  const plan = {
    id: utils.createId('docplan'),
    totalGaps: gaps.length,
    items: gaps.map(g => ({
      gap: g.detail,
      severity: g.severity,
      action: g.severity === 'high' ? 'fix immediately' : 'add to docs update queue',
      type: g.type
    })),
    createdAt: new Date().toISOString()
  };
  return plan;
}

async function createDocsUpdatePrompt(plan = {}, services = {}) {
  const items = plan.items || [];
  return {
    target: 'Codex/OpenCode',
    prompt: `Docs update plan (${plan.id}):\n${items.map(i => `- [${i.severity}] ${i.action}: ${i.gap}`).join('\n')}\n\nConstraints: CommonJS, Node20, no TS, no React. Proposal-only for write.`
  };
}

async function createDocsUpdateProposal(plan = {}, services = {}) {
  return {
    id: utils.createId('docprop'),
    planId: plan.id,
    status: 'pending_approval',
    proposal: `Docs update plan: ${plan.totalGaps} gaps to fix. Requires executor approval before writing.`,
    requiresEvaluation: true,
    requiresApproval: true,
    createdAt: new Date().toISOString()
  };
}

module.exports = { createDocsUpdatePlan, createDocsUpdatePrompt, createDocsUpdateProposal };
