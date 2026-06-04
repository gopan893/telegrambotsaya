'use strict';

const utils = require('./selfhealing-utils');

const CATEGORIES = [
  'boot', 'dashboard', 'natural_chat', 'multibot', 'executor',
  'integration', 'coding_workspace', 'evaluation', 'storage', 'security', 'pwa'
];

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

function createDefaultGuards() {
  return [
    {
      id: 'gd_boot_module_imports',
      name: 'Module imports load without error',
      category: 'boot',
      severity: 'critical',
      enabled: true,
      checkType: 'boot',
      expectedState: 'all_modules_loaded',
      failureMessage: 'One or more src/ modules failed to load',
      suggestedRepair: 'Check require() paths and dependency installation',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_dashboard_tab_registry',
      name: 'Dashboard tab registry complete',
      category: 'dashboard',
      severity: 'critical',
      enabled: true,
      checkType: 'dashboard',
      expectedState: 'all_tabs_registered',
      failureMessage: 'Known tab missing from DASHBOARD_TABS registry',
      suggestedRepair: 'Add missing tab entry in state.js DASHBOARD_TABS',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_dashboard_renderer_present',
      name: 'Known tabs have renderer functions',
      category: 'dashboard',
      severity: 'critical',
      enabled: true,
      checkType: 'dashboard',
      expectedState: 'all_renderers_present',
      failureMessage: 'Known tab registered but renderer function missing',
      suggestedRepair: 'Add renderer function in ui.js for the missing tab',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_dashboard_no_overview_fallback',
      name: 'Known tabs do not fallback to Overview',
      category: 'dashboard',
      severity: 'critical',
      enabled: true,
      checkType: 'dashboard',
      expectedState: 'no_fallback_to_overview',
      failureMessage: 'Known tab falling back to Overview renderer',
      suggestedRepair: 'Fix renderTabContent to render correct tab instead of Overview',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_dashboard_css_dark_forms',
      name: 'Dashboard form controls use dark theme',
      category: 'dashboard',
      severity: 'high',
      enabled: true,
      checkType: 'dashboard',
      expectedState: 'dark_form_css_present',
      failureMessage: 'Form controls may have white/default background',
      suggestedRepair: 'Ensure input/select/textarea use --bg-primary background',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_dashboard_sw_no_api_cache',
      name: 'Service worker does not cache /api/dashboard',
      category: 'dashboard',
      severity: 'high',
      enabled: true,
      checkType: 'dashboard',
      expectedState: 'api_excluded_from_cache',
      failureMessage: 'Service worker may cache API responses',
      suggestedRepair: 'Add condition to skip /api/ paths in service-worker fetch handler',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_natural_chat_teacher_to_orchestrator',
      name: 'Teacher advice routes to Orchestrator/Reflection',
      category: 'natural_chat',
      severity: 'critical',
      enabled: true,
      checkType: 'natural_chat',
      expectedState: 'teacher_advice_not_coder',
      failureMessage: 'Teacher/personal advice routed to Coder agent',
      suggestedRepair: 'Fix natural language router to classify personal advice to Orchestrator',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_natural_chat_no_raw_debug',
      name: 'Personal chat does not show raw debug/router output',
      category: 'natural_chat',
      severity: 'high',
      enabled: true,
      checkType: 'natural_chat',
      expectedState: 'no_raw_debug_output',
      failureMessage: 'Raw router diagnostics leaked to personal chat',
      suggestedRepair: 'Remove console.log/router-debug from personal chat responses',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_executor_proposal_no_auto_run',
      name: 'Proposal creation does not auto-execute',
      category: 'executor',
      severity: 'critical',
      enabled: true,
      checkType: 'executor',
      expectedState: 'proposal_needs_approval',
      failureMessage: 'Proposal created and executed without approval',
      suggestedRepair: 'Ensure createProposal does not call runProposal',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_executor_no_self_approve',
      name: 'Agent cannot self-approve own proposals',
      category: 'executor',
      severity: 'critical',
      enabled: true,
      checkType: 'executor',
      expectedState: 'no_self_approval',
      failureMessage: 'Agent approved its own proposal',
      suggestedRepair: 'Add actorId check in approval: proposer !== approver',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_integration_evaluation_gate_required',
      name: 'External write proposal requires Evaluation v2 pass',
      category: 'integration',
      severity: 'critical',
      enabled: true,
      checkType: 'integration',
      expectedState: 'evaluation_gate_before_external_write',
      failureMessage: 'Integration proposal bypassed Evaluation v2',
      suggestedRepair: 'Add evaluation gate check before creating external write proposal',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_integration_dry_run_no_write',
      name: 'Dry-run never performs external write',
      category: 'integration',
      severity: 'high',
      enabled: true,
      checkType: 'integration',
      expectedState: 'dry_run_read_only',
      failureMessage: 'Dry-run mode performed external write',
      suggestedRepair: 'Ensure dryRun flag prevents mutation in integration executor',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_coding_no_personal_advice',
      name: 'Personal school advice does not trigger Coding Workspace',
      category: 'coding_workspace',
      severity: 'high',
      enabled: true,
      checkType: 'coding_workspace',
      expectedState: 'personal_advice_not_coding',
      failureMessage: 'Personal/school advice routed to Coding Workspace',
      suggestedRepair: 'Fix Coding Workspace classifier to reject personal advice',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_coding_no_repo_mutation',
      name: 'Coding Workspace does not mutate repo directly',
      category: 'coding_workspace',
      severity: 'critical',
      enabled: true,
      checkType: 'coding_workspace',
      expectedState: 'read_only_analysis',
      failureMessage: 'Coding Workspace performed direct repo mutation',
      suggestedRepair: 'Ensure all coding changes require evaluation + executor approval',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_storage_redis_connected',
      name: 'Redis storage is connected',
      category: 'storage',
      severity: 'high',
      enabled: true,
      checkType: 'storage',
      expectedState: 'redis_connected',
      failureMessage: 'Redis connection failed or unavailable',
      suggestedRepair: 'Check REDIS_URL env and Redis server status',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_evaluation_harness_available',
      name: 'Evaluation Harness v2 is available',
      category: 'evaluation',
      severity: 'high',
      enabled: true,
      checkType: 'evaluation',
      expectedState: 'evaluation_harness_loaded',
      failureMessage: 'Evaluation Harness v2 module not loaded',
      suggestedRepair: 'Ensure src/evaluation/index.js exports required functions',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_multibot_messages_no_leak',
      name: 'Multi-bot replies do not leak raw output',
      category: 'multibot',
      severity: 'high',
      enabled: true,
      checkType: 'multibot',
      expectedState: 'visible_replies_no_debug',
      failureMessage: 'Multi-bot replies show raw router/agent output',
      suggestedRepair: 'Ensure visible multibot replies are sanitized',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    },
    {
      id: 'gd_security_no_secret_exposure',
      name: 'No secrets exposed in dashboard or commands',
      category: 'security',
      severity: 'critical',
      enabled: true,
      checkType: 'security',
      expectedState: 'no_secret_exposure',
      failureMessage: 'Secrets/tokens may be exposed in dashboard or command responses',
      suggestedRepair: 'Audit dashboard API serializers and command handlers for secret exposure',
      createdAt: utils.nowISO(),
      updatedAt: utils.nowISO()
    }
  ];
}

module.exports = {
  CATEGORIES,
  SEVERITIES,
  createDefaultGuards
};
