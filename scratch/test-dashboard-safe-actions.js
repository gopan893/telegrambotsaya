'use strict';

const assert = require('assert');
const auth = require('../src/dashboard/dashboard-auth');
const permissions = require('../src/dashboard/dashboard-permissions');
const safeActions = require('../src/dashboard/safe-actions');

function mockRes() {
  return {
    code: null,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function main() {
  const reqNoToken = { headers: {}, app: { locals: { dashboardEnv: { DASHBOARD_ADMIN_TOKEN: 'admin', DASHBOARD_ENABLED: 'true' } } } };
  const res = mockRes();
  let called = false;
  permissions.requireActionPermission('memory/update')(reqNoToken, res, () => { called = true; });
  assert.strictEqual(called, false);
  assert.strictEqual(res.code, 403);

  const reqAdmin = { headers: { authorization: 'Bearer admin' }, app: { locals: { dashboardEnv: { DASHBOARD_ADMIN_TOKEN: 'admin', DASHBOARD_ENABLED: 'true' } } } };
  assert.strictEqual(permissions.getDashboardPermissionLevel(reqAdmin), 'ops');
  assert.strictEqual(permissions.canPerformAction('write', 'memory/update'), true);
  assert.strictEqual(permissions.canPerformAction('write', 'memory/archive'), false);

  const reqWrite = { headers: { authorization: 'Bearer write' }, app: { locals: { dashboardEnv: { DASHBOARD_ADMIN_TOKEN: 'admin', DASHBOARD_WRITE_TOKEN: 'write', DASHBOARD_ENABLED: 'true' } } } };
  const authRes = mockRes();
  let authCalled = false;
  auth.requireDashboardAuth(reqWrite, authRes, () => { authCalled = true; });
  assert.strictEqual(authCalled, true);
  assert.strictEqual(permissions.getDashboardPermissionLevel(reqWrite), 'write');
  assert.strictEqual(permissions.canPerformAction(permissions.getDashboardPermissionLevel(reqWrite), 'memory/update'), true);
  assert.strictEqual(permissions.canPerformAction(permissions.getDashboardPermissionLevel(reqWrite), 'memory/archive'), false);

  const noConfirm = safeActions.validateSafeAction('memory/archive', { userId: 'u1', memoryId: 'm1' });
  assert.strictEqual(noConfirm.ok, false);
  assert.strictEqual(noConfirm.error, 'DOUBLE_CONFIRM_REQUIRED');

  const confirmed = safeActions.validateSafeAction('memory/archive', { userId: 'u1', memoryId: 'm1', confirm: true, confirmationText: 'ARCHIVE' });
  assert.strictEqual(confirmed.ok, true);

  assert.strictEqual(safeActions.rejectSecretLikePayload({ content: 'postgresql://user:secret@example.com/db' }), true);
  assert.strictEqual(safeActions.rejectSecretLikePayload({ content: 'safe content' }), false);

  const result = safeActions.buildActionResult('memory/update', 'ok', { token: 'secret' });
  assert.strictEqual(result.result.token, 'set');

  console.log('test-dashboard-safe-actions: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
