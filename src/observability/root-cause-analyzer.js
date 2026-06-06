'use strict';

const sanitizer = require('./observability-sanitizer');
const timeline = require('./incident-timeline');
const utils = require('./observability-utils');

function correlateWithRecentDeploy(incident = {}, services = {}) {
  const text = `${incident.title || ''} ${incident.summary || ''}`.toLowerCase();
  const signals = [];
  if (/deploy|render|release|rollback/.test(text)) {
    signals.push({
      type: 'deploy',
      confidence: 0.75,
      evidence: 'Incident mentions deploy/render/release.',
      affectedFiles: ['src/deploy/*', 'src/dashboard/deploy-routes.js']
    });
  }
  try {
    const store = require('../deploy/deploy-release-store');
    const plans = store.getDeployPlans?.() || [];
    const latest = plans[plans.length - 1];
    if (latest && /failed|blocked/i.test(latest.status || '')) {
      signals.push({
        type: 'deploy_store',
        confidence: 0.8,
        evidence: `Latest deploy plan status is ${latest.status}.`,
        affectedFiles: ['src/deploy/*']
      });
    }
  } catch (_) {}
  return signals;
}

function correlateWithGitHubActions(incident = {}, services = {}) {
  const text = `${incident.title || ''} ${incident.summary || ''}`.toLowerCase();
  if (!/github|workflow|ci|actions|dashboard regression/.test(text)) return [];
  return [{
    type: 'github_actions',
    confidence: 0.65,
    evidence: 'Incident references GitHub Actions, CI, or dashboard regression.',
    affectedFiles: ['.github/workflows/*', 'scratch/test-dashboard-*.js']
  }];
}

function correlateWithDashboardRouteGuard(incident = {}, services = {}) {
  const text = `${incident.title || ''} ${incident.summary || ''}`.toLowerCase();
  if (!/dashboard|ui is not defined|overview|tab|route|blank/.test(text)) return [];
  return [{
    type: 'dashboard_route_guard',
    confidence: /ui is not defined|blank|overview/.test(text) ? 0.9 : 0.7,
    evidence: 'Dashboard route/UI terms found in incident.',
    affectedFiles: ['public/dashboard/state.js', 'public/dashboard/ui.js', 'public/dashboard/app.js', 'public/dashboard/index.html']
  }];
}

function correlateWithEnvCheck(incident = {}, services = {}) {
  const text = `${incident.title || ''} ${incident.summary || ''}`.toLowerCase();
  if (!/env|database_url|redis_url|token|secret|credential|postgres|redis/.test(text)) return [];
  return [{
    type: 'env_check',
    confidence: /secret|token|database_url|redis_url/.test(text) ? 0.85 : 0.6,
    evidence: 'Incident references env, token, PostgreSQL, or Redis configuration.',
    affectedFiles: ['config/env.js', 'src/storage/*']
  }];
}

function buildRootCauseHypothesis(incident = {}, signals = []) {
  const sorted = signals.sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0];
  if (!top) {
    return {
      confidence: 0.25,
      likelyCause: 'Data belum cukup untuk menentukan root cause.',
      evidence: ['Tidak ada sinyal kuat dari deploy, dashboard route guard, env check, atau GitHub Actions.'],
      affectedFiles: [],
      recommendedNextChecks: ['Jalankan production health check.', 'Periksa timeline incident.', 'Periksa dashboard/deploy logs yang sudah disanitasi.'],
      recommendedMitigation: 'Mulai dari diagnosis read-only sebelum membuat proposal repair/rollback.'
    };
  }
  const mitigationByType = {
    deploy: 'Buat response plan deploy dan rollback proposal jika post-deploy check gagal.',
    deploy_store: 'Review deploy plan terakhir, lalu buat rollback proposal jika perlu.',
    github_actions: 'Periksa workflow/test yang gagal, lalu buat repair proposal tanpa direct push.',
    dashboard_route_guard: 'Jalankan dashboard route regression tests dan buat repair proposal jika ada P0.',
    env_check: 'Jalankan env checker names-only dan storage health check; jangan tampilkan value env.'
  };
  return {
    confidence: top.confidence,
    likelyCause: top.evidence,
    evidence: sorted.map(signal => signal.evidence).slice(0, 5),
    affectedFiles: utils.unique(sorted.flatMap(signal => signal.affectedFiles || [])).slice(0, 12),
    recommendedNextChecks: [
      'Run production health check.',
      'Review incident timeline.',
      top.type === 'dashboard_route_guard' ? 'Run dashboard regression tests.' : '',
      top.type === 'env_check' ? 'Run sanitized env check.' : '',
      top.type === 'github_actions' ? 'Review GitHub Actions status.' : ''
    ].filter(Boolean),
    recommendedMitigation: mitigationByType[top.type] || 'Create an incident response plan before any action.'
  };
}

async function analyzeRootCause(incident = {}, services = {}) {
  const signals = []
    .concat(correlateWithRecentDeploy(incident, services))
    .concat(correlateWithGitHubActions(incident, services))
    .concat(correlateWithDashboardRouteGuard(incident, services))
    .concat(correlateWithEnvCheck(incident, services));
  const tl = await timeline.buildIncidentTimelineFromLogs(incident, services);
  if (tl.some(event => /secret|token|leak/i.test(event.summary || ''))) {
    signals.push({ type: 'security_timeline', confidence: 0.95, evidence: 'Timeline contains secret/security leak signal.', affectedFiles: [] });
  }
  return sanitizer.sanitize(buildRootCauseHypothesis(incident, signals));
}

module.exports = {
  analyzeRootCause,
  buildRootCauseHypothesis,
  correlateWithDashboardRouteGuard,
  correlateWithEnvCheck,
  correlateWithGitHubActions,
  correlateWithRecentDeploy
};
