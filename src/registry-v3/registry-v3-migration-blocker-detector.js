/**
 * Registry v3 Migration Blocker Detector
 * Detects blockers that prevent safe migration to registry v3
 */

const store = require('./registry-v3-store');
const validator = require('./registry-v3-validator');
const conflictDetector = require('./registry-v3-conflict-detector');

async function detectRegistryV3MigrationBlockers(services) {
  const blockers = [];

  const dashboardBlockers = await detectDashboardGenerationBlockers(services);
  blockers.push(...dashboardBlockers);

  const apiBlockers = await detectApiGenerationBlockers(services);
  blockers.push(...apiBlockers);

  const commandBlockers = await detectCommandGenerationBlockers(services);
  blockers.push(...commandBlockers);

  const capabilityBlockers = await detectCapabilityGenerationBlockers(services);
  blockers.push(...capabilityBlockers);

  const criticalBlockers = blockers.filter(b => b.severity === 'critical');
  const highBlockers = blockers.filter(b => b.severity === 'high');
  const mediumBlockers = blockers.filter(b => b.severity === 'medium');

  return {
    hasBlockers: blockers.length > 0,
    canProceed: criticalBlockers.length === 0 && highBlockers.length === 0,
    blockers,
    summary: {
      total: blockers.length,
      critical: criticalBlockers.length,
      high: highBlockers.length,
      medium: mediumBlockers.length
    }
  };
}

async function detectDashboardGenerationBlockers(services) {
  const blockers = [];
  const frozen = store.getFrozen();

  if (!frozen) {
    blockers.push({
      type: 'no_frozen_registry',
      severity: 'critical',
      message: 'Registry v3 not frozen - cannot generate dashboard routes',
      blocksMigration: true
    });
    return blockers;
  }

  const validationResult = await validator.validateRegistryV3Contract(frozen, services);
  if (!validationResult.valid) {
    blockers.push({
      type: 'validation_failed',
      severity: 'critical',
      message: 'Registry v3 validation failed',
      errors: validationResult.errors,
      blocksMigration: true
    });
  }

  const conflictResult = await conflictDetector.detectRegistryV3Conflicts(services);
  if (conflictResult.summary?.p0 > 0) {
    blockers.push({
      type: 'p0_conflicts',
      severity: 'critical',
      message: `${conflictResult.summary.p0} P0 conflicts detected`,
      blocksMigration: true
    });
  }

  const tabs = frozen.items.filter(i => i.type === 'dashboard_tab' && i.status === 'active');
  for (const tab of tabs) {
    if (!tab.rendererId && !tab.apiRouteId) {
      blockers.push({
        type: 'missing_renderer_api',
        severity: 'high',
        message: `Tab ${tab.id} missing renderer and API route`,
        item: tab.id,
        blocksMigration: true
      });
    }

    if (tab.fallbackPolicy === 'overview') {
      blockers.push({
        type: 'invalid_fallback',
        severity: 'high',
        message: `Tab ${tab.id} cannot fallback to Overview`,
        item: tab.id,
        blocksMigration: true
      });
    }
  }

  return blockers;
}

async function detectApiGenerationBlockers(services) {
  const blockers = [];
  const frozen = store.getFrozen();

  if (!frozen) return blockers;

  const apis = frozen.items.filter(i => i.type === 'dashboard_api');

  for (const api of apis) {
    if (api.actionType === 'dangerous' && api.directRunAllowed) {
      blockers.push({
        type: 'dangerous_api_direct_run',
        severity: 'critical',
        message: `API ${api.id} has dangerous directRunAllowed=true`,
        item: api.id,
        blocksMigration: true
      });
    }

    if (!api.responseContract || !api.errorContract) {
      blockers.push({
        type: 'missing_api_contract',
        severity: 'high',
        message: `API ${api.id} missing response or error contract`,
        item: api.id,
        blocksMigration: false
      });
    }

    if (api.visibility === 'public' && api.requiresAuth) {
      blockers.push({
        type: 'api_visibility_conflict',
        severity: 'medium',
        message: `API ${api.id} marked public but requires auth`,
        item: api.id,
        blocksMigration: false
      });
    }
  }

  return blockers;
}

async function detectCommandGenerationBlockers(services) {
  const blockers = [];
  const frozen = store.getFrozen();

  if (!frozen) return blockers;

  const commands = frozen.items.filter(i => i.type === 'telegram_command');
  const seenCommands = new Set();

  for (const cmd of commands) {
    if (seenCommands.has(cmd.command || cmd.id)) {
      blockers.push({
        type: 'duplicate_command',
        severity: 'high',
        message: `Duplicate command: ${cmd.command || cmd.id}`,
        item: cmd.id,
        blocksMigration: true
      });
    }
    seenCommands.add(cmd.command || cmd.id);

    if (cmd.actionType === 'dangerous' && cmd.directRunAllowed) {
      blockers.push({
        type: 'dangerous_command_direct_run',
        severity: 'critical',
        message: `Command ${cmd.id} has dangerous directRunAllowed=true`,
        item: cmd.id,
        blocksMigration: true
      });
    }

    if ((cmd.command || cmd.id).includes('shell') || (cmd.command || cmd.id).includes('exec')) {
      blockers.push({
        type: 'shell_command',
        severity: 'critical',
        message: `Shell command ${cmd.id} is blocked`,
        item: cmd.id,
        blocksMigration: true
      });
    }
  }

  return blockers;
}

async function detectCapabilityGenerationBlockers(services) {
  const blockers = [];
  const frozen = store.getFrozen();

  if (!frozen) return blockers;

  const capabilities = frozen.items.filter(i => i.type === 'capability');

  for (const cap of capabilities) {
    if (cap.actionType === 'dangerous' && cap.directRunAllowed) {
      blockers.push({
        type: 'dangerous_capability_direct_run',
        severity: 'critical',
        message: `Capability ${cap.id} has dangerous directRunAllowed=true`,
        item: cap.id,
        blocksMigration: true
      });
    }

    if (cap.action && (cap.action.includes('shell') || cap.action.includes('executor'))) {
      blockers.push({
        type: 'shell_capability',
        severity: 'critical',
        message: `Shell capability ${cap.id} is blocked`,
        item: cap.id,
        blocksMigration: true
      });
    }

    if (cap.action && cap.action.includes('auto') && cap.action.includes('approve')) {
      blockers.push({
        type: 'auto_approve_capability',
        severity: 'critical',
        message: `Auto-approve capability ${cap.id} is blocked`,
        item: cap.id,
        blocksMigration: true
      });
    }
  }

  return blockers;
}

function buildMigrationBlockerReport(services) {
  const blockerResult = detectRegistryV3MigrationBlockers(services);

  return {
    hasBlockers: blockerResult.hasBlockers,
    canProceed: blockerResult.canProceed,
    summary: blockerResult.summary || {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0
    },
    blockers: blockerResult.blockers || [],
    recommendations: generateBlockerRecommendations(blockerResult),
    migrationReadiness: blockerResult.canProceed ? 'ready' : 'blocked',
    generatedAt: new Date().toISOString()
  };
}

function generateBlockerRecommendations(blockerResult) {
  const recommendations = [];

  if (!blockerResult.hasBlockers) {
    recommendations.push('No migration blockers detected - safe to proceed with migration planning');
    return recommendations;
  }

  const summary = blockerResult.summary;

  if (summary.critical > 0) {
    recommendations.push(`CRITICAL: Fix ${summary.critical} critical blockers before any migration`);
    recommendations.push('Critical blockers include: dangerous directRunAllowed, shell capabilities, validation failures');
  }

  if (summary.high > 0) {
    recommendations.push(`Fix ${summary.high} high-severity blockers before migration`);
    recommendations.push('High-severity blockers include: missing contracts, duplicate commands, unstable tabs');
  }

  if (summary.medium > 0) {
    recommendations.push(`Address ${summary.medium} medium-severity issues to improve migration quality`);
  }

  if (!blockerResult.canProceed) {
    recommendations.push('Migration is BLOCKED - resolve critical and high-severity blockers first');
  }

  return recommendations;
}

module.exports = {
  detectRegistryV3MigrationBlockers,
  detectDashboardGenerationBlockers,
  detectApiGenerationBlockers,
  detectCommandGenerationBlockers,
  detectCapabilityGenerationBlockers,
  buildMigrationBlockerReport
};
