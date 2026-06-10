'use strict';

/**
 * V3 Workflow Device Plugin Convergence Plan
 * Defines unified action contract and safety boundary for all automation layers.
 *
 * CONVERGENCE PRINCIPLES:
 * - Workflow, device, plugin share same safety boundary
 * - Unified action contract for all automation
 * - Unified risk simulation
 * - Unified proposal boundary
 * - No shell/direct dangerous execution
 * - External_write/danger proposal-only
 * - Private data owner-only
 */

const ACTION_SOURCES = ['workflow', 'device', 'plugin', 'agent', 'recipe', 'manual'];

const RISK_LEVELS = ['safe', 'read', 'write', 'external_write', 'danger'];

const UNIFIED_ACTION_CONTRACT = {
  id: 'string',
  source: 'workflow | device | plugin | agent | recipe | manual',
  actionType: 'string',
  capability: 'string',
  riskLevel: 'safe | read | write | external_write | danger',
  input: 'object',
  dryRunSupported: 'boolean',
  requiresEvaluation: 'boolean',
  requiresApproval: 'boolean',
  directRunAllowed: 'boolean',
  ownerOnly: 'boolean',
  auditRequired: 'boolean'
};

/**
 * Create convergence plan for workflow/device/plugin
 * @param {Object} services - Service dependencies
 * @returns {Object} - Convergence plan
 */
async function createConvergencePlanV3(services) {
  const plan = {
    version: 'v3.0.0',
    goal: 'Unified safety boundary for all automation layers',
    layers: {
      workflow: 'Automated task orchestration',
      device: 'Physical/local device control',
      plugin: 'External service integration',
      agent: 'AI-driven automation',
      recipe: 'Reusable automation templates'
    },
    unifiedContract: UNIFIED_ACTION_CONTRACT,
    convergenceStrategy: {
      phase1: 'Map all capabilities to unified contract',
      phase2: 'Implement unified risk simulation',
      phase3: 'Implement unified proposal boundary',
      phase4: 'Migrate existing actions to unified contract',
      phase5: 'Deprecate old action contracts'
    },
    safetyPrinciples: [
      'Shell executor blocked',
      'Direct dangerous actions blocked',
      'External_write/danger proposal-only',
      'Private data owner-only',
      'All actions audited',
      'Dry-run required before execution',
      'Evaluation v2 for risky actions',
      'Approval required for danger level'
    ],
    createdAt: new Date().toISOString()
  };

  return plan;
}

/**
 * Map workflow/device/plugin capabilities to unified contract
 * @param {Object} services - Service dependencies
 * @returns {Object} - Capability mapping
 */
async function mapWorkflowDevicePluginCapabilities(services) {
  const mapping = {
    workflow: {
      totalCapabilities: 0,
      safeCapabilities: [],
      dangerousCapabilities: [],
      requiresConvergence: []
    },
    device: {
      totalCapabilities: 0,
      safeCapabilities: [],
      dangerousCapabilities: [],
      requiresConvergence: []
    },
    plugin: {
      totalCapabilities: 0,
      safeCapabilities: [],
      dangerousCapabilities: [],
      requiresConvergence: []
    }
  };

  // Map workflow capabilities
  if (services.workflowCapabilities) {
    const workflows = await services.workflowCapabilities.listCapabilities?.() || [];
    mapping.workflow.totalCapabilities = workflows.length;
    mapping.workflow.safeCapabilities = workflows.filter(w => w.riskLevel === 'safe');
    mapping.workflow.dangerousCapabilities = workflows.filter(w => w.riskLevel === 'danger');
    mapping.workflow.requiresConvergence = workflows.filter(w => !w.unifiedContract);
  }

  // Map device capabilities
  if (services.deviceCapabilities) {
    const devices = await services.deviceCapabilities.listCapabilities?.() || [];
    mapping.device.totalCapabilities = devices.length;
    mapping.device.safeCapabilities = devices.filter(d => d.riskLevel === 'safe');
    mapping.device.dangerousCapabilities = devices.filter(d => d.riskLevel === 'danger');
    mapping.device.requiresConvergence = devices.filter(d => !d.unifiedContract);
  }

  // Map plugin capabilities
  if (services.pluginCapabilities) {
    const plugins = await services.pluginCapabilities.listCapabilities?.() || [];
    mapping.plugin.totalCapabilities = plugins.length;
    mapping.plugin.safeCapabilities = plugins.filter(p => p.riskLevel === 'safe');
    mapping.plugin.dangerousCapabilities = plugins.filter(p => p.riskLevel === 'danger');
    mapping.plugin.requiresConvergence = plugins.filter(p => !p.unifiedContract);
  }

  return mapping;
}

/**
 * Define unified action contract for v3
 * @param {Object} services - Service dependencies
 * @returns {Object} - Unified action contract
 */
function defineUnifiedActionContractV3(services) {
  return {
    version: 'v3.0.0',
    contract: 'UnifiedActionV3',
    description: 'Standard contract for all automation actions across workflow/device/plugin/agent layers',
    schema: UNIFIED_ACTION_CONTRACT,
    validation: {
      requiredFields: ['id', 'source', 'actionType', 'capability', 'riskLevel'],
      optionalFields: ['input', 'dryRunSupported', 'requiresEvaluation', 'requiresApproval'],
      riskLevelValidation: 'Must be one of: safe, read, write, external_write, danger',
      directRunValidation: 'Only allowed for safe/read actions',
      approvalValidation: 'Required for external_write/danger actions'
    },
    safetyRules: [
      'Shell executor blocked',
      'Direct dangerous execution blocked',
      'External_write requires proposal',
      'Danger level requires approval + evaluation',
      'Private data owner-only',
      'All actions audited'
    ]
  };
}

/**
 * Define unified risk simulation for v3
 * @param {Object} services - Service dependencies
 * @returns {Object} - Unified risk simulation
 */
function defineUnifiedRiskSimulationV3(services) {
  return {
    version: 'v3.0.0',
    system: 'UnifiedRiskSimulationV3',
    description: 'Simulate risks for any action across workflow/device/plugin/agent layers',
    simulationSteps: [
      'Parse action contract',
      'Classify risk level',
      'Identify required approvals',
      'Identify required evaluations',
      'Simulate dry-run if supported',
      'Generate risk report',
      'Recommend mitigation'
    ],
    riskFactors: [
      'Action source (workflow/device/plugin/agent)',
      'Capability type',
      'Input parameters',
      'Target system (local/remote)',
      'Data sensitivity',
      'Reversibility',
      'Blast radius',
      'User context (owner/group/public)'
    ],
    outputFormat: {
      riskLevel: 'safe | read | write | external_write | danger',
      requiresApproval: 'boolean',
      requiresEvaluation: 'boolean',
      directRunAllowed: 'boolean',
      simulationEvidence: 'array of risk indicators',
      recommendations: 'array of mitigation steps'
    }
  };
}

/**
 * Define unified proposal boundary for v3
 * @param {Object} services - Service dependencies
 * @returns {Object} - Unified proposal boundary
 */
function defineUnifiedProposalBoundaryV3(services) {
  return {
    version: 'v3.0.0',
    boundary: 'UnifiedProposalBoundaryV3',
    description: 'All dangerous actions must go through proposal boundary',
    rules: [
      'external_write level -> proposal required',
      'danger level -> proposal + approval + evaluation required',
      'shell command -> blocked',
      'arbitrary remote command -> blocked',
      'direct deploy/push/release/rollback -> blocked',
      'direct webhook POST -> blocked',
      'direct Gmail/Calendar write -> blocked',
      'direct backup restore -> blocked',
      'hard delete -> blocked',
      'secret exposure -> blocked',
      'auto-approve -> blocked',
      'auto-run dangerous -> blocked'
    ],
    proposalFlow: [
      'Action requested',
      'Risk simulation',
      'Proposal created',
      'Evaluation v2 (if danger)',
      'User approval required',
      'Executor runs with audit',
      'Result logged'
    ],
    exemptions: {
      safe: 'Direct run allowed',
      read: 'Direct run allowed with audit',
      write: 'Direct run allowed with approval for internal writes only'
    }
  };
}

/**
 * Build convergence plan v3 report
 * @param {Object} services - Service dependencies
 * @returns {Object} - Convergence plan report
 */
async function buildConvergencePlanV3Report(services) {
  const plan = await createConvergencePlanV3(services);
  const mapping = await mapWorkflowDevicePluginCapabilities(services);

  return {
    report: 'v3-workflow-device-plugin-convergence-plan',
    version: plan.version,
    summary: 'Unified action contract and safety boundary for all automation layers',
    layers: plan.layers,
    capabilityMapping: {
      workflow: mapping.workflow.totalCapabilities,
      device: mapping.device.totalCapabilities,
      plugin: mapping.plugin.totalCapabilities,
      totalCapabilities: mapping.workflow.totalCapabilities +
                        mapping.device.totalCapabilities +
                        mapping.plugin.totalCapabilities
    },
    unifiedContract: 'defined',
    riskSimulation: 'defined',
    proposalBoundary: 'defined',
    safetyPrinciples: plan.safetyPrinciples,
    status: 'planned',
    nextSteps: [
      'Implement unified action contract validator',
      'Implement unified risk simulator',
      'Migrate workflow actions to unified contract',
      'Migrate device actions to unified contract',
      'Migrate plugin actions to unified contract',
      'Test convergence with all action types'
    ],
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  createConvergencePlanV3,
  mapWorkflowDevicePluginCapabilities,
  defineUnifiedActionContractV3,
  defineUnifiedRiskSimulationV3,
  defineUnifiedProposalBoundaryV3,
  buildConvergencePlanV3Report,
  ACTION_SOURCES,
  RISK_LEVELS,
  UNIFIED_ACTION_CONTRACT
};
