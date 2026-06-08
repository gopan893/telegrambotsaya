'use strict';

const crypto = require('crypto');

const PLANS = [];

function generateId() {
  return crypto.createHash('sha1').update(`rp:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

function createCredentialRotationPlan(findingIds, { credentialType, affectedSystems, riskLevel } = {}) {
  const plan = {
    id: generateId(),
    workspaceId: 'default',
    findingIds: findingIds || [],
    credentialType: credentialType || 'unknown',
    affectedSystems: affectedSystems || [],
    riskLevel: riskLevel || 'medium',
    manualSteps: [],
    verificationSteps: [],
    rollbackConsiderations: [],
    status: 'draft',
    createdAt: new Date().toISOString()
  };
  PLANS.push(plan);
  return plan;
}

function createTelegramTokenRotationPlan(findings) {
  return createCredentialRotationPlan(
    (findings || []).map(f => f.id || f),
    {
      credentialType: 'TELEGRAM_TOKEN',
      affectedSystems: ['Telegram Bot', 'Webhook', 'Telegram Control Layer'],
      riskLevel: 'critical',
      manualSteps: [
        '1. Generate new Telegram Bot token via @BotFather on Telegram.',
        '2. Update TELEGRAM_TOKEN in Render environment variables.',
        '3. Redeploy the service on Render.',
        '4. Verify bot responds to /start command.',
        '5. Verify webhook is set correctly via Telegram API.',
        '6. Revoke old token via @BotFather after confirmation.'
      ],
      verificationSteps: [
        'Verify bot responds to /start',
        'Verify webhook set correctly',
        'Verify all Telegram commands work',
        'Verify Telegram Control Layer functions',
        'Verify no bot-to-bot loop'
      ],
      rollbackConsiderations: [
        'Old token remains valid until revoked via @BotFather',
        'Redeploy with old token if new token fails',
        'Keep old token saved in secure backup for 24h after rotation'
      ]
    }
  );
}

function createGithubTokenRotationPlan(findings) {
  return createCredentialRotationPlan(
    (findings || []).map(f => f.id || f),
    {
      credentialType: 'GITHUB_TOKEN',
      affectedSystems: ['GitHub Ops', 'Git Push', 'Workflow Dispatch', 'PR Management'],
      riskLevel: 'critical',
      manualSteps: [
        '1. Generate new GitHub Personal Access Token (classic or fine-grained) on GitHub Settings.',
        '2. Update GITHUB_TOKEN in Render environment variables.',
        '3. Redeploy the service on Render.',
        '4. Verify GitHub Ops functions (list repos, create PRs).',
        '5. Verify git push workflow still works.',
        '6. Revoke old token on GitHub Settings after confirmation.'
      ],
      verificationSteps: [
        'Verify GitHub Ops can list repos',
        'Verify git push still authorized',
        'Verify PR creation works',
        'Verify workflow dispatch'
      ],
      rollbackConsiderations: [
        'Old token remains valid until revoked on GitHub',
        'Redeploy with old token if new token fails',
        'Keep old token backed up for 24h after rotation'
      ]
    }
  );
}

function createDatabaseUrlRotationPlan(findings) {
  return createCredentialRotationPlan(
    (findings || []).map(f => f.id || f),
    {
      credentialType: 'DATABASE_URL',
      affectedSystems: ['PostgreSQL', 'Storage Layer', 'All Data Operations'],
      riskLevel: 'critical',
      manualSteps: [
        '1. Create new PostgreSQL credentials in Render Dashboard or your DB provider.',
        '2. Update DATABASE_URL in Render environment variables.',
        '3. Redeploy the service on Render.',
        '4. Verify database connection via /health endpoint.',
        '5. Verify all CRUD operations work.',
        '6. Revoke old database credentials after confirmation.'
      ],
      verificationSteps: [
        'Verify /health returns storage status ok',
        'Verify memory read/write works',
        'Verify goal/workflow CRUD works',
        'Verify no data loss'
      ],
      rollbackConsiderations: [
        'Old credentials may remain valid depending on DB provider',
        'Keep old DATABASE_URL backed up for recovery',
        'Prepare fallback redeploy with old URL'
      ]
    }
  );
}

function createRenderKeyRotationPlan(findings) {
  return createCredentialRotationPlan(
    (findings || []).map(f => f.id || f),
    {
      credentialType: 'RENDER_API_KEY',
      affectedSystems: ['Render Deploy Gate', 'Deploy/Rollback'],
      riskLevel: 'high',
      manualSteps: [
        '1. Generate new Render API key in Render Dashboard.',
        '2. Update RENDER_API_KEY in Render environment variables.',
        '3. Redeploy the service.',
        '4. Verify deploy gate checks work.',
        '5. Revoke old API key in Render Dashboard.'
      ],
      verificationSteps: [
        'Verify deploy gate functions',
        'Verify deploy proposal creation works',
        'Verify deploy status checks'
      ],
      rollbackConsiderations: [
        'Old API key valid until revoked in Render Dashboard',
        'Keep old key backed up temporarily'
      ]
    }
  );
}

function createGoogleCredentialRotationPlan(findings) {
  return createCredentialRotationPlan(
    (findings || []).map(f => f.id || f),
    {
      credentialType: 'GOOGLE_CLIENT_SECRET',
      affectedSystems: ['Gmail Integration', 'Google Calendar Integration', 'OAuth Flow'],
      riskLevel: 'critical',
      manualSteps: [
        '1. Generate new Google OAuth client secret in Google Cloud Console.',
        '2. Update GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN in Render env.',
        '3. Redeploy the service.',
        '4. Verify Gmail integration still works.',
        '5. Verify Google Calendar integration still works.',
        '6. Revoke old client secret in Google Cloud Console.'
      ],
      verificationSteps: [
        'Verify Gmail send works (dry-run or test)',
        'Verify Calendar read works',
        'Verify OAuth refresh flow'
      ],
      rollbackConsiderations: [
        'Old secret valid until revoked in Google Cloud Console',
        'Redeploy with old secret if needed'
      ]
    }
  );
}

function createCloudflareTokenRotationPlan(findings) {
  return createCredentialRotationPlan(
    (findings || []).map(f => f.id || f),
    {
      credentialType: 'CLOUDFLARE_API_TOKEN',
      affectedSystems: ['Cloudflare Integration', 'DNS/CDN Management'],
      riskLevel: 'high',
      manualSteps: [
        '1. Generate new Cloudflare API token in Cloudflare Dashboard.',
        '2. Update CLOUDFLARE_API_TOKEN in Render environment variables.',
        '3. Redeploy the service.',
        '4. Verify Cloudflare integration works.',
        '5. Revoke old token in Cloudflare Dashboard.'
      ],
      verificationSteps: [
        'Verify Cloudflare API calls work',
        'Verify DNS management (read-only)'
      ],
      rollbackConsiderations: [
        'Old token valid until revoked in Cloudflare Dashboard'
      ]
    }
  );
}

function buildRotationChecklist(plan) {
  if (!plan) return [];
  return [
    `Credential Type: ${plan.credentialType}`,
    `Risk Level: ${plan.riskLevel}`,
    `Affected Systems: ${plan.affectedSystems.join(', ')}`,
    '',
    '=== Manual Steps ===',
    ...plan.manualSteps,
    '',
    '=== Verification Steps ===',
    ...plan.verificationSteps,
    '',
    '=== Rollback Considerations ===',
    ...plan.rollbackConsiderations,
    '',
    'NOTE: This is a manual checklist. Do NOT rotate automatically.',
    'All rotation must be done manually by the system owner.',
    'After rotation, update env vars on Render and redeploy.'
  ].join('\n');
}

function listRotationPlans({ status, limit } = {}) {
  let results = [...PLANS];
  if (status) results = results.filter(p => p.status === status);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (limit) results = results.slice(0, limit);
  return results;
}

function getRotationPlan(planId) {
  return PLANS.find(p => p.id === planId) || null;
}

function updateRotationPlanStatus(planId, status) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return null;
  plan.status = status;
  return plan;
}

function getRotationPlanStats() {
  return {
    total: PLANS.length,
    byStatus: { draft: PLANS.filter(p => p.status === 'draft').length, reviewing: PLANS.filter(p => p.status === 'reviewing').length, completed: PLANS.filter(p => p.status === 'completed').length, archived: PLANS.filter(p => p.status === 'archived').length }
  };
}

module.exports = {
  createCredentialRotationPlan,
  createTelegramTokenRotationPlan,
  createGithubTokenRotationPlan,
  createDatabaseUrlRotationPlan,
  createRenderKeyRotationPlan,
  createGoogleCredentialRotationPlan,
  createCloudflareTokenRotationPlan,
  buildRotationChecklist,
  listRotationPlans,
  getRotationPlan,
  updateRotationPlanStatus,
  getRotationPlanStats
};
