'use strict';

const { createCodingId } = require('./coding-utils');
const { STORAGE_KEYS } = require('./coding-workspace-store');

const TEST_TYPE_SMOKE = 'smoke';
const TEST_TYPE_REGRESSION = 'regression';
const TEST_TYPE_MANUAL = 'manual';

function generateTestPlan(changePlan, services = {}) {
  if (!changePlan) return null;

  const now = new Date().toISOString();
  const planId = createCodingId('testplan');

  const smokeTests = generateSmokeTests(changePlan);
  const regressionTests = generateRegressionTests(changePlan);
  const manualTests = generateManualTestPlan(changePlan);
  const smokeCommands = generateSmokeTestCommands(changePlan);

  return {
    id: planId,
    planId: changePlan.id,
    workspaceId: changePlan.workspaceId,
    userId: changePlan.userId,
    title: `Test plan: ${changePlan.title || 'Untitled'}`,
    smokeTests,
    regressionTests,
    manualTests,
    smokeCommands,
    status: 'generated',
    createdAt: now,
    updatedAt: now
  };
}

function generateRegressionTests(changePlan, services = {}) {
  if (!changePlan) return [];

  const tests = [];
  const category = changePlan.category || 'feature_request';

  // Syntax check
  tests.push({
    name: 'Syntax check',
    command: 'node --check telebot.js',
    expected: 'No syntax errors',
    type: TEST_TYPE_SMOKE
  });

  // Category-specific regression tests
  if (category === 'bug_fix') {
    tests.push({
      name: 'Reproduce original bug',
      command: 'node scratch/test-repro.js',
      expected: 'Bug is fixed, no error thrown',
      type: TEST_TYPE_REGRESSION
    });
  }

  if (category === 'dashboard_issue') {
    tests.push({
      name: 'Dashboard loads without JS errors',
      command: 'Dashboard index.html renders correctly',
      expected: 'All tabs visible, no console errors',
      type: TEST_TYPE_REGRESSION
    });
    tests.push({
      name: 'PWA assets load',
      command: 'Service worker registers, manifest.json available',
      expected: 'PWA installable, offline cache works',
      type: TEST_TYPE_REGRESSION
    });
  }

  if (category === 'telegram_bot_issue') {
    tests.push({
      name: 'Bot responds to /help',
      command: 'Send /help to bot',
      expected: 'Bot replies with help text',
      type: TEST_TYPE_REGRESSION
    });
    tests.push({
      name: 'Bot responds to /menu',
      command: 'Send /menu to bot',
      expected: 'Bot replies with menu keyboard',
      type: TEST_TYPE_REGRESSION
    });
  }

  if (category === 'database_storage_issue') {
    tests.push({
      name: 'Database connection works',
      command: 'Bot starts with DATABASE_URL configured',
      expected: 'No SQL errors on startup',
      type: TEST_TYPE_REGRESSION
    });
    tests.push({
      name: 'JSON fallback works',
      command: 'Bot starts without DATABASE_URL',
      expected: 'Bot runs with JSON storage',
      type: TEST_TYPE_REGRESSION
    });
  }

  if (category === 'feature_request' || category === 'phase_prompt') {
    tests.push({
      name: 'New feature does not break existing commands',
      command: 'Run all core commands',
      expected: 'All commands respond correctly',
      type: TEST_TYPE_REGRESSION
    });
  }

  // Affected area specific tests
  if (changePlan.affectedAreas) {
    for (const area of changePlan.affectedAreas) {
      if (area.includes('conversation') || area.includes('memory')) {
        tests.push({
          name: 'Conversation continuity preserved',
          command: 'Send follow-up messages like "iya", "lanjut"',
          expected: 'Bot understands context correctly',
          type: TEST_TYPE_REGRESSION
        });
      }
      if (area.includes('interactions') || area.includes('ux')) {
        tests.push({
          name: 'Inline keyboard callbacks work',
          command: 'Press inline buttons',
          expected: 'Callbacks handled correctly',
          type: TEST_TYPE_REGRESSION
        });
      }
      if (area.includes('evaluation') || area.includes('governance')) {
        tests.push({
          name: 'Safety gates still active',
          command: 'Test with dangerous input',
          expected: 'Safety layer blocks or warns',
          type: TEST_TYPE_REGRESSION
        });
      }
    }
  }

  return tests;
}

function generateManualTestPlan(changePlan, services = {}) {
  if (!changePlan) return [];

  const tests = [
    { step: 1, action: 'Start bot locally with npm start', expected: 'Bot starts without errors' },
    { step: 2, action: 'Send /help to bot', expected: 'Bot responds with help text' },
    { step: 3, action: 'Test the specific changed feature', expected: 'Feature works as expected' },
    { step: 4, action: 'Verify no error in console', expected: 'Clean console output' }
  ];

  const category = changePlan.category || '';

  if (category.includes('dashboard')) {
    tests.push(
      { step: 5, action: 'Open dashboard in browser', expected: 'Dashboard renders correctly' },
      { step: 6, action: 'Check mobile responsive layout', expected: 'UI adapts to mobile screen' }
    );
  }

  if (category.includes('bot') || category.includes('telegram')) {
    tests.push(
      { step: 5, action: 'Test inline keyboard interactions', expected: 'Buttons respond correctly' },
      { step: 6, action: 'Test conversation flow', expected: 'Follow-up messages work' }
    );
  }

  return tests;
}

function generateSmokeTestCommands(changePlan, services = {}) {
  const commands = ['node --check telebot.js'];

  const category = changePlan?.category || '';

  if (category === 'bug_fix') {
    commands.push('node scratch/test-repro.js');
  }

  if (category === 'dashboard_issue') {
    commands.push('node scratch/test-pwa-assets.js');
    commands.push('node scratch/test-dashboard-agent-routing.js');
  }

  if (category === 'telegram_bot_issue') {
    commands.push('node scratch/test-visible-multibot-replies.js');
    commands.push('node scratch/test-short-followup-context.js');
  }

  if (category === 'database_storage_issue') {
    commands.push('node scratch/test-agent-evaluation-v2.js');
  }

  if (category === 'feature_request' || category === 'phase_prompt') {
    commands.push('node scratch/test-integration-evaluation-gate.js');
    commands.push('node scratch/test-agent-executor-natural-chat.js');
  }

  if (category === 'security_issue') {
    commands.push('node scratch/test-file-analysis-leak.js');
  }

  if (category === 'github_issue_pr') {
    commands.push('node scratch/test-integration-proposal-pipeline.js');
  }

  return commands;
}

function generateSmokeTests(changePlan, services = {}) {
  if (!changePlan) return [];

  return [
    { name: 'Syntax check', command: 'node --check telebot.js', expected: 'No errors' },
    { name: 'Bot starts', command: 'node telebot.js & sleep 2', expected: 'Bot process running' },
    { name: 'Help command', command: '/help', expected: 'Help text returned' }
  ];
}

module.exports = {
  generateTestPlan,
  generateRegressionTests,
  generateManualTestPlan,
  generateSmokeTestCommands
};
