'use strict';

const axios = require('axios');
const sanitizer = require('../connector-result-sanitizer');

const CONNECTOR_ID = 'github';

function getConfig(env = process.env) {
  return {
    tokenConfigured: Boolean(env.GITHUB_TOKEN),
    owner: env.GITHUB_OWNER || '',
    repo: env.GITHUB_REPO || '',
    configured: Boolean(env.GITHUB_TOKEN && env.GITHUB_OWNER && env.GITHUB_REPO)
  };
}

function setupPlan(config = getConfig()) {
  return {
    configured: false,
    status: 'setup_required',
    missing: [
      config.tokenConfigured ? '' : 'GITHUB_TOKEN',
      config.owner ? '' : 'GITHUB_OWNER',
      config.repo ? '' : 'GITHUB_REPO'
    ].filter(Boolean),
    nextSteps: [
      'Create a GitHub token with minimal repository scope.',
      'Set GITHUB_OWNER and GITHUB_REPO in Render env.',
      'Never paste GITHUB_TOKEN into Telegram chat.'
    ]
  };
}

function actionMetadata(action) {
  const readOnly = ['github.status', 'github.repo.info', 'github.issues.list'].includes(action);
  const proposalOnly = ['github.issue.create', 'github.pr.create', 'github.comment.create', 'github.issue.plan', 'github.pr.plan', 'github.comment.plan'].includes(action);
  return {
    connectorId: CONNECTOR_ID,
    action,
    readOnly,
    proposalOnly,
    riskLevel: readOnly ? 'low' : 'medium',
    requiresApproval: !readOnly
  };
}

async function runReadOnly(action, payload = {}, context = {}, services = {}) {
  const env = services.env || process.env;
  const config = getConfig(env);
  if (action === 'github.status') {
    return { ok: true, connectorId: CONNECTOR_ID, action, result: config.configured ? { configured: true, owner: config.owner, repo: config.repo, tokenConfigured: true } : setupPlan(config) };
  }
  if (!config.configured) return { ok: true, connectorId: CONNECTOR_ID, action, result: setupPlan(config) };
  const headers = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' };
  if (action === 'github.repo.info') {
    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
    const res = await axios.get(url, { headers, timeout: 8000 });
    return { ok: true, connectorId: CONNECTOR_ID, action, result: sanitizer.sanitizeConnectorResult({
      fullName: res.data.full_name,
      private: res.data.private,
      defaultBranch: res.data.default_branch,
      openIssues: res.data.open_issues_count,
      pushedAt: res.data.pushed_at
    }) };
  }
  if (action === 'github.issues.list') {
    const state = payload.state || 'open';
    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`;
    const res = await axios.get(url, { headers, timeout: 8000, params: { state, per_page: Math.min(Number(payload.limit || 10), 30) } });
    return { ok: true, connectorId: CONNECTOR_ID, action, result: (res.data || []).slice(0, 20).map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      htmlUrl: issue.html_url,
      pullRequest: Boolean(issue.pull_request)
    })) };
  }
  return { ok: false, connectorId: CONNECTOR_ID, action, error: 'UNSUPPORTED_GITHUB_READ_ACTION' };
}

function buildWritePlan(action, payload = {}, context = {}) {
  const title = payload.title || payload.text || context.text || 'GitHub proposal';
  return {
    ok: true,
    connectorId: CONNECTOR_ID,
    action,
    proposalOnly: true,
    riskLevel: 'medium',
    requiresApproval: true,
    dryRun: {
      wouldWrite: true,
      externalWriteBlocked: true,
      target: action,
      title: sanitizer.compactText(title, 160),
      bodyPreview: sanitizer.compactText(payload.body || payload.description || payload.text || '', 420)
    }
  };
}

module.exports = {
  CONNECTOR_ID,
  actionMetadata,
  buildWritePlan,
  getConfig,
  runReadOnly,
  setupPlan
};
