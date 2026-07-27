'use strict';

const utils = require('./autoheal-utils');

function createDefaultActions() {
  const now = utils.nowISO();
  return [
    { id: 'ah_dashboard_cache_stale', name: 'Mark stale dashboard cache', category: 'dashboard', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 300, maxRunsPerDay: 24, handlerName: 'markDashboardCacheStale', createdAt: now, updatedAt: now },
    { id: 'ah_routine_lock_clear', name: 'Clear expired routine locks', category: 'routine', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 60, maxRunsPerDay: 1440, handlerName: 'clearExpiredRoutineLocks', createdAt: now, updatedAt: now },
    { id: 'ah_monitoring_disconnect_stale', name: 'Disconnect stale monitoring clients', category: 'monitoring', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 30, maxRunsPerDay: 2880, handlerName: 'disconnectStaleClients', createdAt: now, updatedAt: now },
    { id: 'ah_connector_degrade_readonly', name: 'Degrade connector to read-only', category: 'integration', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 600, maxRunsPerDay: 12, handlerName: 'degradeConnectorToReadonly', createdAt: now, updatedAt: now },
    { id: 'ah_botloop_suppress', name: 'Suppress bot-to-bot loop temporarily', category: 'multibot', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 900, maxRunsPerDay: 4, handlerName: 'suppressBotLoop', createdAt: now, updatedAt: now },
    { id: 'ah_evalgate_mark_degraded', name: 'Mark evaluation gate degraded', category: 'evaluation', level: 'L0', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 3600, maxRunsPerDay: 1, handlerName: 'markEvalGateDegraded', createdAt: now, updatedAt: now },
    { id: 'ah_healthcheck_rerun', name: 'Rerun read-only health check', category: 'boot', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 120, maxRunsPerDay: 720, handlerName: 'rerunHealthCheck', createdAt: now, updatedAt: now },
    { id: 'ah_pwa_cache_warning', name: 'Set PWA cache warning flag', category: 'pwa', level: 'L1', riskLevel: 'low', enabled: true, requiresApproval: false, requiresEvaluation: false, cooldownSeconds: 600, maxRunsPerDay: 6, handlerName: 'setPwaCacheWarning', createdAt: now, updatedAt: now },
    { id: 'ah_dashboard_route_repair', name: 'Propose dashboard route repair', category: 'dashboard', level: 'L2', riskLevel: 'high', enabled: true, requiresApproval: true, requiresEvaluation: true, cooldownSeconds: 3600, maxRunsPerDay: 3, handlerName: 'proposeDashboardRepair', createdAt: now, updatedAt: now },
    { id: 'ah_code_repair', name: 'Propose code repair', category: 'code', level: 'L2', riskLevel: 'high', enabled: true, requiresApproval: true, requiresEvaluation: true, cooldownSeconds: 7200, maxRunsPerDay: 2, handlerName: 'proposeCodeRepair', createdAt: now, updatedAt: now },
    { id: 'ah_integration_config_change', name: 'Propose integration config change', category: 'integration', level: 'L2', riskLevel: 'high', enabled: true, requiresApproval: true, requiresEvaluation: true, cooldownSeconds: 7200, maxRunsPerDay: 2, handlerName: 'proposeIntegrationConfigChange', createdAt: now, updatedAt: now },
    { id: 'ah_github_workflow_dispatch', name: 'Propose GitHub workflow dispatch', category: 'cicd', level: 'L2', riskLevel: 'critical', enabled: true, requiresApproval: true, requiresEvaluation: true, cooldownSeconds: 14400, maxRunsPerDay: 1, handlerName: 'proposeWorkflowDispatch', createdAt: now, updatedAt: now },
    { id: 'ah_deploy_trigger', name: 'Propose deploy trigger', category: 'cicd', level: 'L2', riskLevel: 'critical', enabled: true, requiresApproval: true, requiresEvaluation: true, cooldownSeconds: 14400, maxRunsPerDay: 1, handlerName: 'proposeDeploy', createdAt: now, updatedAt: now },
    { id: 'ah_shell_execution', name: 'Shell execution', category: 'danger', level: 'L3', riskLevel: 'critical', enabled: false, requiresApproval: true, requiresEvaluation: true, cooldownSeconds: 86400, maxRunsPerDay: 0, handlerName: '', createdAt: now, updatedAt: now },
  ];
}

module.exports = { createDefaultActions };
