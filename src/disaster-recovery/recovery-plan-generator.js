'use strict';

const store = require('./dr-store');
const utils = require('./dr-utils');

function generateRecoveryPlan(scope, services) {
  const scopeCheck = utils.validateDrScope(scope);
  if (!scopeCheck.ok) return { ok: false, error: scopeCheck.error };

  const generators = {
    postgres_recovery: generatePostgresRecoveryPlan,
    redis_recovery: generateRedisRecoveryPlan,
    render_redeploy_recovery: generateRenderRecoveryPlan,
    telegram_webhook_recovery: generateTelegramWebhookRecoveryPlan,
    github_actions_recovery: generateGitHubActionsRecoveryPlan,
    dashboard_recovery: generateDashboardRecoveryPlan,
    config_recovery: generateConfigRecoveryPlan,
    secret_rotation_rehearsal: generateSecretRotationRehearsalPlan,
    full_ai_os_recovery: generateFullAiOsRecoveryPlan
  };

  const generator = generators[scope];
  if (!generator) return { ok: false, error: 'NO_GENERATOR_FOR_SCOPE' };

  return generator(services);
}

function generatePostgresRecoveryPlan(services) {
  const plan = store.createPlan('postgres_recovery', {
    name: 'PostgreSQL Recovery Plan',
    status: 'planned',
    envNames: ['DATABASE_URL'],
    riskLevel: 'high',
    approvalRequired: true,
    steps: [
      'Verify DATABASE_URL environment variable is configured',
      'Stop application services that depend on the database',
      'Restore from latest pg_dump backup file',
      'Run psql to verify restored database',
      'Run application health checks',
      'Re-enable application services'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['PostgreSQL client (psql) installed', 'Access to backup storage', 'DATABASE_URL env name configured'],
      backupSources: ['pg_dump file from backup store', 'WAL archive if continuous archiving enabled'],
      restoreSteps: plan.steps,
      verificationSteps: ['SELECT count(*) from key tables', 'Check recent data exists', 'Run application smoke tests'],
      rollbackConsiderations: 'If restore fails, revert to previous backup version. PostgreSQL PITR may be needed for point-in-time recovery.',
      riskLevel: 'high',
      approvalRequirements: 'Requires workspace owner or admin approval. Confirmation text: RESTORE_POSTGRES',
      testsAfterRecovery: ['Application login flow', 'Dashboard data loading', 'Telegram bot health check']
    })
  };
}

function generateRedisRecoveryPlan(services) {
  const plan = store.createPlan('redis_recovery', {
    name: 'Redis Recovery Plan',
    status: 'planned',
    envNames: ['REDIS_URL'],
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Verify REDIS_URL environment variable is configured',
      'Check Redis server connectivity',
      'Restore from RDB/AOF backup file',
      'Verify keyspace restored',
      'Reconnect application cache layer'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['Redis CLI (redis-cli) installed', 'RDB or AOF backup file available', 'REDIS_URL env name configured'],
      backupSources: ['RDB snapshot file', 'AOF append-only file'],
      restoreSteps: plan.steps,
      verificationSteps: ['INFO keyspace shows expected key count', 'Test cache get/set operations'],
      rollbackConsiderations: 'Redis restore is fast. Previous RDB file can be reapplied if needed.',
      riskLevel: 'medium',
      approvalRequirements: 'Requires admin approval. Confirmation text: RESTORE_REDIS',
      testsAfterRecovery: ['Session persistence', 'Rate limiter functionality']
    })
  };
}

function generateRenderRecoveryPlan(services) {
  const plan = store.createPlan('render_redeploy_recovery', {
    name: 'Render Redeploy Recovery Plan',
    status: 'planned',
    envNames: ['RENDER_API_KEY'],
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Verify RENDER_API_KEY environment variable is configured (name only)',
      'Check Render dashboard for current deployment status',
      'Prepare redeploy payload with correct service ID',
      'Trigger deployment via Render API',
      'Monitor deployment logs until healthy'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['RENDER_API_KEY env name configured', 'Render service ID known', 'Deployment script ready'],
      backupSources: ['Previous deployment manifest'],
      restoreSteps: plan.steps,
      verificationSteps: ['Deployment status shows "Live"', 'Health endpoint returns 200', 'Recent deploy log shows no errors'],
      rollbackConsiderations: 'Redeploy previous working version via Render dashboard or API.',
      riskLevel: 'medium',
      approvalRequirements: 'Requires admin or ops approval. Confirmation text: REDEPLOY_RENDER',
      testsAfterRecovery: ['Telegram bot responds', 'Dashboard loads', 'API endpoints respond']
    })
  };
}

function generateTelegramWebhookRecoveryPlan(services) {
  const plan = store.createPlan('telegram_webhook_recovery', {
    name: 'Telegram Webhook Recovery Plan',
    status: 'planned',
    envNames: ['TELEGRAM_TOKEN'],
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Verify TELEGRAM_TOKEN environment variable is configured (name only)',
      'Check current webhook status via getWebhookInfo',
      'Delete and re-register webhook with correct URL',
      'Verify webhook responds with 200 OK',
      'Send test message to confirm bot is operational'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['TELEGRAM_TOKEN env name configured', 'Webhook URL known', 'Telegram Bot API accessible'],
      backupSources: ['Webhook configuration backup'],
      restoreSteps: plan.steps,
      verificationSteps: ['getWebhookInfo returns correct URL', 'Bot responds to messages', 'No webhook errors in logs'],
      rollbackConsiderations: 'Previous webhook URL can be re-registered. Token remains unchanged.',
      riskLevel: 'medium',
      approvalRequirements: 'Requires admin approval. Confirmation text: RESTORE_TELEGRAM',
      testsAfterRecovery: ['Telegram command processing', 'Inline query responses']
    })
  };
}

function generateGitHubActionsRecoveryPlan(services) {
  const plan = store.createPlan('github_actions_recovery', {
    name: 'GitHub Actions Recovery Plan',
    status: 'planned',
    envNames: ['GITHUB_TOKEN'],
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Verify GITHUB_TOKEN environment variable is configured (name only)',
      'Check GitHub Actions runner status',
      'Validate workflow files in .github/workflows/',
      'Re-register GitHub Actions secrets if needed',
      'Trigger test workflow to verify pipeline health'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['GITHUB_TOKEN env name configured', 'Workflow files intact', 'GitHub repository access'],
      backupSources: ['Workflow YAML files in repository', 'GitHub Actions secrets backup'],
      restoreSteps: plan.steps,
      verificationSteps: ['Workflow dispatch succeeds', 'Runner picks up job', 'Job completes successfully'],
      rollbackConsiderations: 'Previous workflow version can be restored from git history.',
      riskLevel: 'medium',
      approvalRequirements: 'Requires admin approval. Confirmation text: RESTORE_GITHUB',
      testsAfterRecovery: ['CI pipeline passes', 'Release workflow functions']
    })
  };
}

function generateDashboardRecoveryPlan(services) {
  const plan = store.createPlan('dashboard_recovery', {
    name: 'Dashboard Recovery Plan',
    status: 'planned',
    envNames: ['DASHBOARD_ADMIN_TOKEN'],
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Verify DASHBOARD_ADMIN_TOKEN environment variable is configured (name only)',
      'Restore dashboard configuration from backup',
      'Validate dashboard registry and sidebar entries',
      'Check PWA cache and service worker files',
      'Verify all known dashboard tabs render correctly'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['DASHBOARD_ADMIN_TOKEN env name configured', 'Dashboard backup file available'],
      backupSources: ['Dashboard configuration backup', 'UI template files'],
      restoreSteps: plan.steps,
      verificationSteps: ['Dashboard loads without errors', 'All tabs navigable', 'PWA service worker registered'],
      rollbackConsiderations: 'Previous dashboard config can be restored from backup.',
      riskLevel: 'medium',
      approvalRequirements: 'Requires admin approval. Confirmation text: RESTORE_DASHBOARD',
      testsAfterRecovery: ['Tab navigation', 'API data loading', 'Theme consistency']
    })
  };
}

function generateConfigRecoveryPlan(services) {
  const plan = store.createPlan('config_recovery', {
    name: 'Configuration Recovery Plan',
    status: 'planned',
    envNames: [],
    riskLevel: 'low',
    approvalRequired: false,
    steps: [
      'Restore configuration files from backup',
      'Validate JSON/YAML syntax',
      'Verify configuration values are within expected ranges',
      'Restart application services if needed'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['Configuration backup file available'],
      backupSources: ['Config backup from store'],
      restoreSteps: plan.steps,
      verificationSteps: ['Config parses correctly', 'Application starts without errors'],
      rollbackConsiderations: 'Previous config file can be restored.',
      riskLevel: 'low',
      approvalRequirements: 'Minimal approval needed.',
      testsAfterRecovery: ['Application health check']
    })
  };
}

function generateSecretRotationRehearsalPlan(services) {
  const plan = store.createPlan('secret_rotation_rehearsal', {
    name: 'Secret Rotation Rehearsal Plan',
    status: 'planned',
    envNames: utils.generateEnvNameList(),
    riskLevel: 'low',
    approvalRequired: false,
    steps: [
      'Identify all active secrets and their locations',
      'Prepare manual rotation checklist for each secret type',
      'Simulate token rotation without calling provider APIs',
      'Document verification steps for each rotated secret',
      'Generate rotation rehearsal report'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['Access to .env file (read-only)', 'Knowledge of each provider\'s rotation process'],
      backupSources: ['None - rehearsal does not create backups'],
      restoreSteps: plan.steps,
      verificationSteps: ['Each secret type has a manual checklist', 'No provider API was called'],
      rollbackConsiderations: 'N/A - rehearsal only, no actual rotation performed.',
      riskLevel: 'low',
      approvalRequirements: 'No approval needed for rehearsal.',
      testsAfterRecovery: []
    })
  };
}

function generateFullAiOsRecoveryPlan(services) {
  const subPlans = [
    generatePostgresRecoveryPlan(services),
    generateRedisRecoveryPlan(services),
    generateDashboardRecoveryPlan(services),
    generateRenderRecoveryPlan(services),
    generateTelegramWebhookRecoveryPlan(services),
    generateGitHubActionsRecoveryPlan(services),
    generateConfigRecoveryPlan(services)
  ];

  const plan = store.createPlan('full_ai_os_recovery', {
    name: 'Full AI OS Recovery Plan',
    status: 'planned',
    envNames: utils.generateEnvNameList(),
    riskLevel: 'high',
    approvalRequired: true,
    steps: [
      'Execute Postgres recovery first (foundation for all data)',
      'Execute Redis recovery (session/cache layer)',
      'Execute Dashboard recovery (UI layer)',
      'Execute Render redeploy (hosting)',
      'Execute Telegram webhook recovery (communication)',
      'Execute GitHub Actions recovery (CI/CD)',
      'Execute configuration recovery (settings)',
      'Verify full system health end-to-end'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      prerequisites: ['All sub-plan prerequisites met', 'Full AI OS backup file available'],
      backupSources: ['Full system backup snapshot'],
      restoreSteps: plan.steps,
      verificationSteps: [
        'All sub-plan verification steps pass',
        'End-to-end health check: bot + dashboard + API + CI/CD'
      ],
      rollbackConsiderations: 'Full rollback requires re-running each sub-plan in reverse order.',
      riskLevel: 'high',
      approvalRequirements: 'Requires owner or admin approval. Multiple confirmation gates needed.',
      testsAfterRecovery: [
        'Application login session flow',
        'Telegram message send/receive',
        'Dashboard data loading',
        'GitHub Actions workflow trigger',
        'Database query execution'
      ],
      subPlans: subPlans.map(sp => sp.ok ? { scope: sp.plan.scope, status: sp.plan.status } : { error: sp.error })
    })
  };
}

module.exports = {
  generateRecoveryPlan,
  generatePostgresRecoveryPlan,
  generateRedisRecoveryPlan,
  generateRenderRecoveryPlan,
  generateTelegramWebhookRecoveryPlan,
  generateGitHubActionsRecoveryPlan,
  generateDashboardRecoveryPlan,
  generateFullAiOsRecoveryPlan
};
