/**
 * Command Generation Preview Builder
 * Generates preview of Telegram commands from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const commandContract = require('./telegram-command-contract-v3');
const v3utils = require('../registry-v3/registry-v3-utils');

function buildCommandGenerationPreview(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      success: false,
      error: 'No frozen registry v3 available'
    };
  }

  const commandItems = frozen.items.filter(i => i.type === 'telegram_command');

  const preview = {
    generatedAt: new Date().toISOString(),
    source: 'registry-v3-frozen',
    totalCommands: commandItems.length,
    commands: [],
    unsafeCommands: [],
    warnings: []
  };

  for (const item of commandItems) {
    const result = commandContract.buildTelegramCommandContractV3(item, services);
    if (!result.success) {
      preview.warnings.push({ id: item.id, error: result.error });
      continue;
    }

    const c = result.contract;

    const cmdPreview = {
      command: c.command,
      canonicalCommand: c.canonicalCommand,
      aliases: c.aliases,
      description: c.description,
      module: c.module,
      riskLevel: c.riskLevel,
      actionType: c.actionType,
      requiresOwner: c.requiresOwner,
      requiresAdmin: c.requiresAdmin,
      requiresApproval: c.requiresApproval,
      requiresEvaluation: c.requiresEvaluation,
      directRunAllowed: c.directRunAllowed,
      enabled: c.enabled
    };

    preview.commands.push(cmdPreview);

    if (v3utils.isDangerousActionType(c.actionType) && c.directRunAllowed) {
      preview.unsafeCommands.push({
        command: c.command,
        issue: 'Dangerous action with directRunAllowed=true',
        severity: 'P0'
      });
    }

    if (c.actionType === 'external_write' && !c.requiresApproval) {
      preview.unsafeCommands.push({
        command: c.command,
        issue: 'External write without approval',
        severity: 'P0'
      });
    }

    const cmdLower = c.command.toLowerCase();
    if (cmdLower.includes('shell') || cmdLower.includes('exec')) {
      preview.unsafeCommands.push({
        command: c.command,
        issue: 'Potential shell/exec command',
        severity: 'P0'
      });
    }
  }

  preview.isSafe = preview.unsafeCommands.length === 0;

  return {
    success: true,
    preview: v3utils.sanitizeForDisplay(preview)
  };
}

function validateCommandGenerationPreview(preview, services) {
  const errors = [];
  const warnings = [];

  if (!preview) {
    errors.push('Preview is null');
    return { valid: false, errors, warnings };
  }

  if (!Array.isArray(preview.commands)) {
    errors.push('Missing commands array');
    return { valid: false, errors, warnings };
  }

  for (const cmd of preview.commands) {
    if (!cmd.command) {
      errors.push('Command missing command field');
    }
    if (cmd.riskLevel === 'critical' && cmd.directRunAllowed) {
      errors.push(`Critical command ${cmd.command} has directRunAllowed=true`);
    }
  }

  const unsafe = preview.unsafeCommands || [];
  for (const u of unsafe) {
    if (u.severity === 'P0') {
      errors.push(`P0 unsafe: ${u.command} - ${u.issue}`);
    } else {
      warnings.push(`Unsafe: ${u.command} - ${u.issue}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function buildCommandGenerationPreviewReport(services) {
  const result = buildCommandGenerationPreview(services);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      generatedAt: new Date().toISOString()
    };
  }

  const validation = validateCommandGenerationPreview(result.preview, services);

  return {
    success: true,
    preview: result.preview,
    validation,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildCommandGenerationPreview,
  validateCommandGenerationPreview,
  buildCommandGenerationPreviewReport
};