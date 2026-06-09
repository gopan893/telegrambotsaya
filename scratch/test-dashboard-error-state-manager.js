'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // buildDashboardErrorState
  const error = new Error('Something broke');
  error.code = 500;
  const state = mobile.dashboardErrorStateManager.buildDashboardErrorState(error, {});
  assert(state.hasError === true, 'buildDashboardErrorState hasError true');
  assert(typeof state.message === 'string', 'error state has message');
  assert(state.code === 500, 'error state code 500');
  assert(state.retryable === true, 'error state retryable true');

  // buildEmptyState
  const empty = mobile.dashboardErrorStateManager.buildEmptyState('overview', {});
  assert(empty.empty === true, 'empty state empty true');
  assert(empty.tab === 'overview', 'empty state tab is overview');
  assert(empty.hasData === false, 'empty state hasData false');
  assert(typeof empty.message === 'string', 'empty state has message');

  // buildLoadingState
  const loading = mobile.dashboardErrorStateManager.buildLoadingState('agents', {});
  assert(loading.loading === true, 'loading state loading true');
  assert(loading.tab === 'agents', 'loading state tab is agents');
  assert(typeof loading.message === 'string', 'loading state has message');

  // buildDegradedModuleState
  const degraded = mobile.dashboardErrorStateManager.buildDegradedModuleState('monitoring', {});
  assert(degraded.degraded === true, 'degraded state degraded true');
  assert(degraded.module === 'monitoring', 'degraded state module name');
  assert(degraded.coreFunctionalityAvailable === true, 'core functionality available');
  assert(typeof degraded.message === 'string', 'degraded state has message');

  // sanitizeDashboardError - strips secrets
  const secretError = new Error('Token is abc123 and password is secret!');
  const sanitized = mobile.dashboardErrorStateManager.sanitizeDashboardError(secretError, {});
  assert(!sanitized.message.includes('abc123'), 'sanitized error strips tokens');
  assert(!sanitized.message.includes('secret!'), 'sanitized error strips passwords');

  // sanitizeDashboardError - string error
  const stringErr = mobile.dashboardErrorStateManager.sanitizeDashboardError('just a string', {});
  assert(typeof stringErr.message === 'string', 'string error converted to object');
  assert(stringErr.code === 500, 'string error default code 500');

  // sanitizeDashboardError - null
  const nullErr = mobile.dashboardErrorStateManager.sanitizeDashboardError(null, {});
  assert(nullErr.message === 'Unknown error', 'null error handled');

  // sanitizeDashboardError - no stack trace with env values
  const envError = new Error('DATABASE_URL=postgresql://localhost/mydb');
  const envSanitized = mobile.dashboardErrorStateManager.sanitizeDashboardError(envError, {});
  assert(!envSanitized.message.includes('DATABASE_URL'), 'sanitized error strips DATABASE_URL');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
