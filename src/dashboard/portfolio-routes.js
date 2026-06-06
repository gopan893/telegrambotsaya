'use strict';

const express = require('express');
const portfolio = require('../portfolio');
const guards = require('./dashboard-guards');
const workspaceRoutes = require('./workspace-routes');

function getActor(req, services = {}) {
  return workspaceRoutes.getActorId(req, services) || String(req.body?.actorId || req.query?.actorId || 'dashboard-admin');
}

function getUser(req, services = {}) {
  return guards.validateUserId(req.body?.userId || req.query?.userId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || getActor(req, services)) || getActor(req, services);
}

function getWorkspace(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || 'default').trim();
}

function buildServices(req, services = {}) {
  return {
    ...services,
    actorId: getActor(req, services),
    userId: getUser(req, services),
    workspaceId: getWorkspace(req),
    actorType: 'dashboard',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

function route(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      return guards.safeDashboardResponse(res, {
        ok: false,
        error: 'PORTFOLIO_ROUTE_FAILED',
        message: err?.message || 'Portfolio module unavailable'
      }, 200);
    }
  };
}

function registerPortfolioRoutes(router, services = {}) {
  const dr = express.Router();

  dr.get('/', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const snapshot = await portfolio.portfolioScanner.buildPortfolioSnapshot(runtime.workspaceId, runtime);
    const next = await portfolio.portfolioNextActionEngine.recommendPortfolioNextAction(snapshot.workspaceId, runtime);
    return guards.safeDashboardResponse(res, { ok: true, snapshot, nextAction: next });
  }));

  dr.get('/snapshot', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const snapshot = await portfolio.portfolioScanner.scanActivePortfolio(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, snapshot);
  }));

  dr.get('/projects', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const snapshot = await portfolio.portfolioScanner.buildPortfolioSnapshot(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, { ok: true, workspaceId: snapshot.workspaceId, items: snapshot.activeGoals });
  }));

  dr.get('/health', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const snapshot = await portfolio.portfolioScanner.buildPortfolioSnapshot(runtime.workspaceId, runtime);
    const items = [];
    for (const goal of snapshot.activeGoals || []) {
      items.push(await portfolio.projectHealthScorer.scoreProjectHealth(goal.id, runtime));
    }
    return guards.safeDashboardResponse(res, { ok: true, workspaceId: snapshot.workspaceId, items });
  }));

  dr.get('/priorities', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const items = await portfolio.projectPriorityEngine.rankProjects(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, { ok: true, workspaceId: runtime.workspaceId, items });
  }));

  dr.get('/dependencies', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.projectDependencyDetector.detectProjectDependencies(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.get('/stale', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.projectStalenessDetector.detectStaleProjects(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.get('/risk', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.portfolioRiskReview.reviewPortfolioRisk(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.get('/cost', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.portfolioCostReview.buildPortfolioCostSummary(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.get('/next-action', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.portfolioNextActionEngine.recommendPortfolioNextAction(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.post('/weekly-plan', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.portfolioStrategyPlanner.createWeeklyPortfolioPlan(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.post('/monthly-plan', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await portfolio.portfolioStrategyPlanner.createMonthlyPortfolioPlan(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.post('/proposal', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const next = req.body?.nextAction || await portfolio.portfolioNextActionEngine.recommendPortfolioNextAction(runtime.workspaceId, runtime);
    const planResult = await portfolio.portfolioProposalBridge.createPortfolioActionPlan({ ...next, workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    if (!planResult.ok) return guards.safeDashboardResponse(res, planResult, planResult.status || 400);
    const proposal = await portfolio.portfolioProposalBridge.createPortfolioExecutorProposal(planResult.actionPlan, runtime);
    return guards.safeDashboardResponse(res, proposal.ok ? { ok: true, actionPlan: planResult.actionPlan, ...proposal } : proposal, proposal.ok ? 200 : 400);
  }));

  dr.get('/report', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const type = String(req.query.type || 'weekly').toLowerCase();
    const result = type === 'monthly'
      ? await portfolio.portfolioReportGenerator.generatePortfolioMonthlyReport(runtime.workspaceId, runtime)
      : type === 'daily'
        ? await portfolio.portfolioReportGenerator.generatePortfolioDailyReport(runtime.workspaceId, runtime)
        : await portfolio.portfolioReportGenerator.generatePortfolioWeeklyReport(runtime.workspaceId, runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  router.use('/portfolio', dr);
}

module.exports = {
  registerPortfolioRoutes
};
