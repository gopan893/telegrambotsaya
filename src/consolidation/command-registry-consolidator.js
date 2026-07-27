'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

async function auditTelegramCommands(services = {}) {
  const cmdPath = path.join(BASE, 'src', 'telegram-control', 'telegram-command-registry.js');
  try {
    const content = fs.readFileSync(cmdPath, 'utf8');
    const commands = [];
    const cmdBlocks = content.split('{').filter(b => b.includes('name:'));
    for (const block of cmdBlocks) {
      const nameMatch = block.match(/name:\s*['"`]([^'"`]+)['"`]/);
      const descMatch = block.match(/description:\s*['"`]([^'"`]+)['"`]/);
      const riskMatch = block.match(/riskLevel:\s*['"`]([^'"`]+)['"`]/);
      const enabledMatch = block.match(/enabled:\s*(true|false)/);
      const approvalMatch = block.match(/requiresApproval:\s*(true|false)/);
      const evalMatch = block.match(/requiresEvaluation:\s*(true|false)/);
      if (nameMatch) {
        commands.push({
          name: nameMatch[1],
          description: descMatch ? descMatch[1] : '',
          riskLevel: riskMatch ? riskMatch[1] : 'unknown',
          enabled: enabledMatch ? enabledMatch[1] === 'true' : true,
          requiresApproval: approvalMatch ? approvalMatch[1] === 'true' : false,
          requiresEvaluation: evalMatch ? evalMatch[1] === 'true' : false
        });
      }
    }
    return commands;
  } catch (_) {
    return [];
  }
}

async function detectCommandConflicts(services = {}) {
  const commands = await auditTelegramCommands(services);
  const nameCount = {};
  for (const cmd of commands) {
    nameCount[cmd.name] = (nameCount[cmd.name] || 0) + 1;
  }
  return Object.entries(nameCount)
    .filter(([_, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));
}

async function detectMissingCommandDocs(services = {}) {
  const commands = await auditTelegramCommands(services);
  return commands.filter(cmd => !cmd.description || cmd.description.trim() === '');
}

async function detectUnsafeCommandRoutes(services = {}) {
  const commands = await auditTelegramCommands(services);
  return commands.filter(cmd =>
    (cmd.riskLevel === 'high' || cmd.riskLevel === 'danger') &&
    !cmd.requiresApproval
  );
}

function buildCommandRegistryReport(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Command registry consolidation report',
    rules: [
      'Old commands preserved',
      'Risky commands proposal-only',
      'Unknown commands show safe help'
    ]
  };
}

module.exports = {
  auditTelegramCommands,
  detectCommandConflicts,
  detectMissingCommandDocs,
  detectUnsafeCommandRoutes,
  buildCommandRegistryReport
};
