'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const { registerDashboardRoutes } = require('../src/dashboard/dashboard-routes');
const { createMonitoringSystem } = require('../src/monitoring');
const { createCicdSystem } = require('../src/cicd');

const memoryStorage = {
  data: {},
  async safeRead(key, fallback) { return this.data[key] || fallback; },
  async safeWrite(key, value) { this.data[key] = value; return true; }
};

function listen(app) {
  const server = http.createServer(app);
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function request(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function run() {
  const app = express();
  app.use(express.json());
  const env = { DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'dash-token' };
  const monitoringSystem = createMonitoringSystem(null, { env });
  const cicdSystem = createCicdSystem(memoryStorage, {
    env,
    evaluationSystem: { async runEvalCases() { return { cicdSafetyScore: 100, deployApprovalBoundaryScore: 100 }; } },
    executorSystem: { async createProposal(input) { return { id: 'exec_cicd_test', ...input }; } }
  });

  registerDashboardRoutes(app, {
    env,
    storageManager: { getStorageStatus: () => ({ driver: 'json' }) },
    monitoringSystem,
    cicdSystem
  });

  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/dashboard`;
  const headers = { Authorization: 'Bearer dash-token', 'Content-Type': 'application/json' };

  try {
    const blocked = await request(baseUrl, '/cicd/status');
    assert.strictEqual(blocked.res.status, 401, 'protected endpoint rejects missing token');

    const status = await request(baseUrl, '/cicd/status', { headers });
    assert.strictEqual(status.res.status, 200, 'cicd status ok');
    assert.strictEqual(status.body.ok, true, 'cicd status payload ok');

    const workflows = await request(baseUrl, '/cicd/workflows', { headers });
    assert(workflows.body.workflows.some(workflow => workflow.id === 'ci.yml'), 'workflows endpoint lists ci');

    const proposal = await request(baseUrl, '/cicd/workflow-dispatch/propose', {
      method: 'POST',
      headers,
      body: JSON.stringify({ workflowId: 'release-check.yml' })
    });
    assert.strictEqual(proposal.body.ok, true, 'workflow dispatch creates proposal only');
    assert.strictEqual(proposal.body.proposalId, 'exec_cicd_test', 'proposal id returned');

    const monitoring = await request(baseUrl, '/monitoring/snapshot', { headers });
    assert.strictEqual(monitoring.body.ok, true, 'monitoring snapshot ok');
    assert(!JSON.stringify(monitoring.body).includes('dash-token'), 'dashboard token not leaked');

    console.log('test-cicd-dashboard-api: ok');
  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
