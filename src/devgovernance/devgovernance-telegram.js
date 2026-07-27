'use strict';

const devGov = require('./index');
const utils = require('./devgovernance-utils');

const COMMANDS = [
  '/devgov', '/handoff', '/handoff_update', '/archmap',
  '/contractcheck', '/collisioncheck', '/dashboardroutes',
  '/nextcodex', '/nextopencode', '/p0prompt'
];

function isDevGovCommand(cmd) {
  return COMMANDS.includes(cmd);
}

async function handleDevGovCommand(cmd, args, chatId, services) {
  const svc = { repoRoot: process.cwd() };

  switch (cmd) {
    case '/devgov': {
      const contract = devGov.contractManager.getAgentContractSummary(svc);
      const handoffResult = devGov.handoffOrchestrator.generateHandoffSummary(svc);
      const text = [
        '🏛️ Dev Governance',
        '',
        `Contract: ${contract.ok ? '✅ Valid' : '❌ Issues'}`,
        `Handoff: ${handoffResult.ok ? '✅ Present' : '❌ Missing'}`,
        `Last Agent: ${handoffResult.ok ? handoffResult.summary.lastAgent : 'Unknown'}`,
        `Unfinished: ${handoffResult.ok ? handoffResult.summary.unfinished : 0}`,
        `Tests Failed: ${handoffResult.ok ? handoffResult.summary.testsFailed : 0}`,
        '',
        'Commands: /handoff /contractcheck /collisioncheck /dashboardroutes /nextcodex /nextopencode /archmap'
      ].join('\n');
      return { text };
    }

    case '/handoff': {
      const result = devGov.handoffOrchestrator.generateHandoffSummary(svc);
      if (!result.ok) return { text: '❌ No handoff found.' };
      const h = result.handoff;
      const text = [
        '📋 Agent Handoff',
        `ID: ${h.id || '-'}`,
        `Last Agent: ${h.lastAgent || '-'}`,
        `Task: ${h.currentTask || '-'}`,
        `Goal: ${h.goal || '-'}`,
        `Files Changed: ${(h.filesChanged || []).length}`,
        `Completed: ${(h.completed || []).length}`,
        `Unfinished: ${(h.unfinished || []).length}`,
        `Tests Run: ${(h.testsRun || []).length}`,
        `Tests Failed: ${(h.testsFailed || []).length}`,
        `Tests Skipped: ${(h.testsSkipped || []).length}`,
      ].join('\n');
      return { text };
    }

    case '/handoff_update': {
      if (!args) return { text: 'Usage: /handoff_update <task>:<goal>' };
      const parts = args.split(':');
      const currentTask = parts[0] || '';
      const goal = parts[1] || '';
      const result = devGov.handoffOrchestrator.readHandoff(svc);
      if (!result.ok) return { text: '❌ Cannot read handoff' };
      const handoff = result.handoff;
      if (currentTask) handoff.currentTask = currentTask;
      if (goal) handoff.goal = goal;
      devGov.handoffOrchestrator.writeHandoff(handoff, svc);
      return { text: '✅ Handoff updated.' };
    }

    case '/archmap': {
      const status = devGov.architectureMapGenerator.getArchitectureMapStatus(svc);
      const text = [
        '🏗️ Architecture Map',
        `Entry Points: ${status.entryPoints}`,
        `Dashboard Tabs: ${status.dashboardTabs.found}/${status.dashboardTabs.total}`,
        `Backend Routes: ${status.dashboardRoutes}`,
        `Module Groups: ${status.moduleGroups}`,
        status.warnings.length ? `\nWarnings:\n${status.warnings.join('\n')}` : ''
      ].join('\n');
      return { text };
    }

    case '/contractcheck': {
      const result = devGov.contractManager.validateAgentContract(svc);
      const text = [
        '📜 Agent Contract Check',
        `Status: ${result.ok ? '✅ Valid' : '❌ Issues'}`,
        `Sections: ${result.summary?.sectionCount || 0}`,
        result.warnings?.length ? `\nWarnings:\n${result.warnings.join('\n')}` : '',
        result.errors?.length ? `\nErrors:\n${result.errors.join('\n')}` : ''
      ].join('\n');
      return { text };
    }

    case '/collisioncheck': {
      const result = devGov.collisionDetector.detectCollisions(svc);
      const text = [
        '🔍 Collision Check',
        `Total: ${result.total}`,
        `Critical: ${result.critical.length}`,
        `Warnings: ${result.warnings.length}`,
        result.critical.length ? `\nCritical:\n${result.critical.map(c => `- ${c.message}`).join('\n')}` : ''
      ].join('\n');
      return { text };
    }

    case '/dashboardroutes': {
      const result = devGov.dashboardRouteConsistency.validateDashboardRoutes(svc);
      const text = [
        '🗺️ Dashboard Routes',
        `Issues: ${result.total}`,
        `Critical: ${result.critical.length}`,
        `Warnings: ${result.warnings.length}`,
        result.critical.length ? `\nCritical:\n${result.critical.map(c => `- ${c.message}`).join('\n')}` : ''
      ].join('\n');
      return { text };
    }

    case '/nextcodex': {
      const promptRes = devGov.nextAgentPromptGenerator.generateNextAgentPrompt('codex', { services: svc });
      return { text: `📝 Next Codex Prompt:\n\n${utils.maskSecrets(promptRes.prompt).slice(0, 3800)}` };
    }

    case '/nextopencode': {
      const promptRes = devGov.nextAgentPromptGenerator.generateNextAgentPrompt('opencode', { services: svc });
      return { text: `📝 Next OpenCode Prompt:\n\n${utils.maskSecrets(promptRes.prompt).slice(0, 3800)}` };
    }

    case '/p0prompt': {
      const promptRes = devGov.nextAgentPromptGenerator.generateNextAgentPrompt('p0', { services: svc, issue: args || 'Unknown P0 issue' });
      return { text: `📝 P0 Patch Prompt:\n\n${utils.maskSecrets(promptRes.prompt).slice(0, 3800)}` };
    }

    default:
      return null;
  }
}

module.exports = {
  COMMANDS,
  isDevGovCommand,
  handleDevGovCommand
};
