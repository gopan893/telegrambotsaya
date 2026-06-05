'use strict';

function createGithubStatus(services) {
  const env = services?.env || process.env;

  function isConfigured() {
    return Boolean(env.GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_APP_TOKEN);
  }

  function setupPlan() {
    return {
      ok: false,
      configured: false,
      status: 'missing_credentials',
      setupRequired: true,
      summary: 'GitHub credentials belum dikonfigurasi. Status CI/CD memakai fallback setup plan.',
      requiredEnv: ['GITHUB_TOKEN or GH_TOKEN'],
      safe: true
    };
  }

  async function postCheckRun(name, status, conclusion, details) {
    return { ok: false, name, status, conclusion, details, readonly: false, requiresApproval: true, summary: 'GitHub check write requires executor proposal.' };
  }

  async function postDeployment(environment, ref, task) {
    return { ok: false, environment, ref, task, readonly: false, requiresApproval: true, summary: 'GitHub deployment write requires executor proposal.' };
  }

  async function updateCommitStatus(sha, context, state, description) {
    return { ok: false, sha, context, state, description, readonly: false, requiresApproval: true, summary: 'GitHub commit status write requires executor proposal.' };
  }

  async function getLatestActions() {
    if (!isConfigured()) return setupPlan();
    return { ok: true, configured: true, actions: [], readonly: true, summary: 'GitHub Actions status adapter ready. Network fetch is intentionally optional in runtime.' };
  }

  async function getGithubActionsStatus() {
    const latest = await getLatestActions();
    if (!latest.ok) return latest;
    return {
      ok: true,
      configured: true,
      status: 'available',
      workflows: ['ci.yml', 'release-check.yml', 'dashboard-regression.yml'],
      latestRuns: latest.actions || [],
      readonly: true
    };
  }

  async function getLatestWorkflowRuns() {
    const status = await getGithubActionsStatus();
    return status.ok ? { ok: true, runs: status.latestRuns || [] } : status;
  }

  function summarizeWorkflowRun(run = {}) {
    return {
      id: run.id || run.databaseId || '',
      name: run.name || run.workflowName || 'workflow',
      status: run.status || 'unknown',
      conclusion: run.conclusion || '',
      branch: run.headBranch || run.branch || '',
      createdAt: run.createdAt || run.created_at || ''
    };
  }

  async function buildCicdStatusReport() {
    const status = await getGithubActionsStatus();
    if (!status.ok) return status;
    return {
      ok: true,
      summary: 'CI/CD status read-only.',
      workflows: status.workflows,
      latestRuns: (status.latestRuns || []).map(summarizeWorkflowRun),
      readonly: true
    };
  }

  return {
    postCheckRun,
    postDeployment,
    updateCommitStatus,
    getLatestActions,
    getGithubActionsStatus,
    getLatestWorkflowRuns,
    summarizeWorkflowRun,
    buildCicdStatusReport
  };
}

module.exports = { createGithubStatus };
