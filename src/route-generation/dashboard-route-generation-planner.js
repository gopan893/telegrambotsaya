/**
 * Dashboard Route Generation Planner
 * Creates route generation plans from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const tabContract = require('./dashboard-tab-contract-v3');
const apiContract = require('./dashboard-api-contract-v3');
const rendererContract = require('./dashboard-renderer-contract-v3');

async function createDashboardRouteGenerationPlan(services) {
  const { logger } = services;

  try {
    const frozen = store.getFrozen();

    if (!frozen || !frozen.items) {
      return {
        success: false,
        error: 'No frozen registry v3 available'
      };
    }

    const plan = {
      createdAt: new Date().toISOString(),
      source: 'registry-v3',
      sourceVersion: frozen.version || '3.0.0',
      phases: [],
      artifacts: [],
      affectedFiles: [],
      compatibilityStrategy: 'bridge',
      rollbackStrategy: 'keep-v2-intact',
      testStrategy: 'regression-suite',
      blockers: [],
      readiness: 'unknown'
    };

    const sidebarPlan = await planSidebarGenerationFromRegistryV3(services);
    if (sidebarPlan.success) {
      plan.phases.push({
        name: 'sidebar_generation',
        description: 'Generate sidebar menu from registry v3',
        artifacts: sidebarPlan.artifacts,
        blockers: sidebarPlan.blockers
      });
      plan.artifacts.push(...sidebarPlan.artifacts);
      plan.affectedFiles.push(...sidebarPlan.affectedFiles);
    }

    const routerPlan = await planRouterGenerationFromRegistryV3(services);
    if (routerPlan.success) {
      plan.phases.push({
        name: 'router_generation',
        description: 'Generate router entries from registry v3',
        artifacts: routerPlan.artifacts,
        blockers: routerPlan.blockers
      });
      plan.artifacts.push(...routerPlan.artifacts);
      plan.affectedFiles.push(...routerPlan.affectedFiles);
    }

    const rendererBindingPlan = await planRendererBindingFromRegistryV3(services);
    if (rendererBindingPlan.success) {
      plan.phases.push({
        name: 'renderer_binding',
        description: 'Generate renderer bindings from registry v3',
        artifacts: rendererBindingPlan.artifacts,
        blockers: rendererBindingPlan.blockers
      });
      plan.artifacts.push(...rendererBindingPlan.artifacts);
      plan.affectedFiles.push(...rendererBindingPlan.affectedFiles);
    }

    const mobileNavPlan = await planMobileNavGenerationFromRegistryV3(services);
    if (mobileNavPlan.success) {
      plan.phases.push({
        name: 'mobile_nav_generation',
        description: 'Generate mobile navigation from registry v3',
        artifacts: mobileNavPlan.artifacts,
        blockers: mobileNavPlan.blockers
      });
      plan.artifacts.push(...mobileNavPlan.artifacts);
      plan.affectedFiles.push(...mobileNavPlan.affectedFiles);
    }

    const apiRoutePlan = await planApiRouteGenerationFromRegistryV3(services);
    if (apiRoutePlan.success) {
      plan.phases.push({
        name: 'api_route_generation',
        description: 'Generate API routes from registry v3',
        artifacts: apiRoutePlan.artifacts,
        blockers: apiRoutePlan.blockers
      });
      plan.artifacts.push(...apiRoutePlan.artifacts);
      plan.affectedFiles.push(...apiRoutePlan.affectedFiles);
    }

    plan.blockers = collectAllBlockers(plan.phases);
    plan.readiness = plan.blockers.length === 0 ? 'ready' : 'blocked';

    if (logger) {
      logger.info('[Route Generation] Plan created', {
        phases: plan.phases.length,
        artifacts: plan.artifacts.length,
        blockers: plan.blockers.length
      });
    }

    return {
      success: true,
      plan
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function planSidebarGenerationFromRegistryV3(services) {
  const frozen = store.getFrozen();
  const tabs = frozen.items.filter(i => i.type === 'dashboard_tab' && i.enabled);

  return {
    success: true,
    artifacts: [
      {
        type: 'preview',
        name: 'sidebar_preview.json',
        location: 'docs/generated-preview/',
        description: 'Sidebar menu structure preview'
      }
    ],
    affectedFiles: [
      'public/dashboard/index.html',
      'public/dashboard/ui.js'
    ],
    blockers: tabs.length === 0 ? ['No dashboard tabs in registry'] : []
  };
}

async function planRouterGenerationFromRegistryV3(services) {
  const frozen = store.getFrozen();
  const tabs = frozen.items.filter(i => i.type === 'dashboard_tab' && i.enabled);

  return {
    success: true,
    artifacts: [
      {
        type: 'preview',
        name: 'router_preview.json',
        location: 'docs/generated-preview/',
        description: 'Router configuration preview'
      }
    ],
    affectedFiles: [
      'public/dashboard/router.js',
      'public/dashboard/app.js'
    ],
    blockers: tabs.length === 0 ? ['No dashboard tabs in registry'] : []
  };
}

async function planRendererBindingFromRegistryV3(services) {
  const frozen = store.getFrozen();
  const renderers = frozen.items.filter(i => i.type === 'dashboard_renderer' && i.enabled);

  return {
    success: true,
    artifacts: [
      {
        type: 'preview',
        name: 'renderer_binding_preview.json',
        location: 'docs/generated-preview/',
        description: 'Renderer binding configuration preview'
      }
    ],
    affectedFiles: [
      'public/dashboard/index.html'
    ],
    blockers: renderers.length === 0 ? ['No renderers in registry'] : []
  };
}

async function planMobileNavGenerationFromRegistryV3(services) {
  const frozen = store.getFrozen();
  const mobileTabs = frozen.items.filter(i =>
    i.type === 'dashboard_tab' && i.enabled && i.mobileVisible
  );

  return {
    success: true,
    artifacts: [
      {
        type: 'preview',
        name: 'mobile_nav_preview.json',
        location: 'docs/generated-preview/',
        description: 'Mobile navigation structure preview'
      }
    ],
    affectedFiles: [
      'public/dashboard/index.html',
      'public/dashboard/ui.js'
    ],
    blockers: mobileTabs.length === 0 ? ['No mobile-visible tabs in registry'] : []
  };
}

async function planApiRouteGenerationFromRegistryV3(services) {
  const frozen = store.getFrozen();
  const apis = frozen.items.filter(i => i.type === 'dashboard_api' && i.enabled);

  return {
    success: true,
    artifacts: [
      {
        type: 'preview',
        name: 'api_routes_preview.json',
        location: 'docs/generated-preview/',
        description: 'API routes configuration preview'
      }
    ],
    affectedFiles: [
      'src/dashboard/routes.js'
    ],
    blockers: apis.length === 0 ? ['No API routes in registry'] : []
  };
}

function collectAllBlockers(phases) {
  const blockers = [];

  for (const phase of phases) {
    if (phase.blockers && phase.blockers.length > 0) {
      blockers.push(...phase.blockers.map(b => ({
        phase: phase.name,
        blocker: b
      })));
    }
  }

  return blockers;
}

function buildRouteGenerationPlanReport(services) {
  const planResult = createDashboardRouteGenerationPlan(services);

  if (!planResult.success) {
    return {
      success: false,
      error: planResult.error
    };
  }

  const plan = planResult.plan;

  return {
    success: true,
    summary: {
      phases: plan.phases.length,
      artifacts: plan.artifacts.length,
      affectedFiles: plan.affectedFiles.length,
      blockers: plan.blockers.length,
      readiness: plan.readiness
    },
    plan,
    recommendations: generatePlanRecommendations(plan)
  };
}

function generatePlanRecommendations(plan) {
  const recommendations = [];

  if (plan.readiness === 'blocked') {
    recommendations.push('Resolve blockers before executing route generation');
  }

  if (plan.affectedFiles.length > 0) {
    recommendations.push('Backup affected files before generation');
  }

  if (plan.readiness === 'ready') {
    recommendations.push('Route generation plan is ready - proceed to preview phase');
  }

  return recommendations;
}

module.exports = {
  createDashboardRouteGenerationPlan,
  planSidebarGenerationFromRegistryV3,
  planRouterGenerationFromRegistryV3,
  planRendererBindingFromRegistryV3,
  planMobileNavGenerationFromRegistryV3,
  planApiRouteGenerationFromRegistryV3,
  buildRouteGenerationPlanReport
};
