'use strict';

const priority = require('./project-priority-engine');
const riskReview = require('./portfolio-risk-review');
const costReview = require('./portfolio-cost-review');
const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

function buildPlan(type, workspaceId, title, steps, context = {}) {
  return utils.sanitize({
    ok: true,
    id: utils.createId('portfolio_plan'),
    workspaceId,
    type,
    title,
    steps: steps.slice(0, 12),
    riskLevel: context.riskLevel || 'low',
    topProject: context.topProject || null,
    requiresExecutorApproval: false,
    createdAt: utils.nowIso()
  });
}

async function createStabilizationPlan(workspaceId, services = {}) {
  const risk = await riskReview.reviewPortfolioRisk(workspaceId, services);
  return buildPlan('stabilize_first', risk.workspaceId || workspaceId, 'Stabilize first', [
    'Tutup atau mitigasi incident critical/high.',
    'Pastikan dashboard route dan service worker stabil.',
    'Jalankan Evaluation v2 dan regression test penting.',
    'Buat executor proposal hanya jika ada action write/external/danger.'
  ], { riskLevel: risk.riskLevel });
}

async function createFeatureDeliveryPlan(workspaceId, services = {}) {
  const top = await priority.recommendTopProject(workspaceId, services);
  return buildPlan('ship_feature', workspaceId, 'Feature delivery sprint', [
    `Fokus ke project: ${top.topProject?.goal?.title || '-'}.`,
    'Pilih satu task kecil dengan impact tinggi.',
    'Implement, jalankan test terkait, lalu update handoff.',
    'Push/deploy tetap lewat Evaluation v2 + executor proposal.'
  ], { topProject: top.topProject });
}

async function createCostSavingPlan(workspaceId, services = {}) {
  const cost = await costReview.suggestCostSavingPortfolioPlan(workspaceId, services);
  return buildPlan('reduce_cost', cost.workspaceId || workspaceId, 'Cost-saving portfolio pass', cost.steps, { riskLevel: 'medium' });
}

async function createQualityImprovementPlan(workspaceId, services = {}) {
  return buildPlan('quality_improvement', workspaceId, 'Quality improvement sprint', [
    'Jalankan dashboard route, executor boundary, integration gate, natural chat, dan PWA tests.',
    'Tambahkan regression test untuk area yang baru berubah.',
    'Perbaiki P0/P1 sebelum feature baru.',
    'Update docs/handoff agar agent berikutnya tidak mengulang audit.'
  ], { riskLevel: 'low' });
}

async function createWeeklyPortfolioPlan(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const risk = await riskReview.reviewPortfolioRisk(snapshot.workspaceId, services);
  if (['critical', 'high'].includes(risk.riskLevel)) return createStabilizationPlan(snapshot.workspaceId, services);
  if (snapshot.costStatus?.status === 'warning') return createCostSavingPlan(snapshot.workspaceId, services);
  const plan = await createFeatureDeliveryPlan(snapshot.workspaceId, services);
  await utils.auditPortfolio('portfolio/weekly_plan_created', { workspaceId: snapshot.workspaceId, userId: services.userId, summary: plan }, services);
  return plan;
}

async function createMonthlyPortfolioPlan(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const weekly = await createWeeklyPortfolioPlan(snapshot.workspaceId, services);
  const quality = await createQualityImprovementPlan(snapshot.workspaceId, services);
  const plan = buildPlan('monthly_portfolio', snapshot.workspaceId, 'Monthly portfolio plan', [
    'Minggu 1: stabilisasi P0/P1 dan incident.',
    'Minggu 2: delivery top project.',
    'Minggu 3: quality hardening, docs, dan regression.',
    'Minggu 4: release readiness, cost review, dan handoff.'
  ], { topProject: weekly.topProject || null, riskLevel: weekly.riskLevel || 'low' });
  plan.relatedPlans = [weekly, quality];
  await utils.auditPortfolio('portfolio/monthly_plan_created', { workspaceId: snapshot.workspaceId, userId: services.userId, summary: plan }, services);
  return plan;
}

module.exports = {
  createCostSavingPlan,
  createFeatureDeliveryPlan,
  createMonthlyPortfolioPlan,
  createQualityImprovementPlan,
  createStabilizationPlan,
  createWeeklyPortfolioPlan
};
