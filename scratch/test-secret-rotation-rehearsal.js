'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  // Test each secret type
  const types = ['telegram_token', 'github_token', 'render_api_key', 'database_url', 'cloudflare_token'];
  for (const type of types) {
    const result = await dr.secretRotationRehearsal.createSecretRotationRehearsal(type, {});
    assert(result.ok, `${type} rehearsal returns ok`);
    assert(result.secretType === type, `${type} secretType correct`);
    assert(result.envName, `${type} has envName`);
    assert(result.steps.length > 0, `${type} has steps`);
    assert(result.manualChecklist.length > 0, `${type} has manual checklist`);
    assert(result.verificationSteps.length > 0, `${type} has verification steps`);

    // Verify no actual API calls / mutations
    assert(result.note.includes('REHEARSAL ONLY'), `${type} is rehearsal only`);
    assert(result.note.includes('No actual'), `${type} note confirms no actual mutation`);

    // Verify no secret values exposed
    const resultStr = JSON.stringify(result);
    assert(!resultStr.includes('sk-') && !resultStr.includes('xoxb-'),
      `${type} result does not contain API key values`);
  }

  // Invalid type
  const bad = await dr.secretRotationRehearsal.createSecretRotationRehearsal('bogus_type', {});
  assert(!bad.ok, 'invalid secret type returns error');

  // Build report
  const result = await dr.secretRotationRehearsal.createSecretRotationRehearsal('telegram_token', {});
  const report = dr.secretRotationRehearsal.buildSecretRotationRehearsalReport(result, {});
  assert(report.ok, 'buildSecretRotationRehearsalReport returns ok');
  assert(report.report.secretType === 'telegram_token', 'report has correct secret type');
  assert(report.report.manualChecklist.length > 0, 'report has manual checklist');
  assert(report.report.note.includes('REHEARSAL ONLY'), 'report is rehearsal only');

  // Report with null
  const nullReport = dr.secretRotationRehearsal.buildSecretRotationRehearsalReport(null, {});
  assert(!nullReport.ok, 'buildSecretRotationRehearsalReport rejects null');

  // Test direct simulation functions
  const tg = dr.secretRotationRehearsal.simulateTelegramTokenRotation({});
  assert(tg.ok, 'simulateTelegramTokenRotation returns ok');
  assert(tg.envName === 'TELEGRAM_TOKEN', 'simulateTelegramTokenRotation envName correct');

  const gh = dr.secretRotationRehearsal.simulateGithubTokenRotation({});
  assert(gh.ok, 'simulateGithubTokenRotation returns ok');
  assert(gh.envName === 'GITHUB_TOKEN', 'simulateGithubTokenRotation envName correct');

  const render = dr.secretRotationRehearsal.simulateRenderKeyRotation({});
  assert(render.ok, 'simulateRenderKeyRotation returns ok');
  assert(render.envName === 'RENDER_API_KEY', 'simulateRenderKeyRotation envName correct');

  const db = dr.secretRotationRehearsal.simulateDatabaseUrlRotation({});
  assert(db.ok, 'simulateDatabaseUrlRotation returns ok');
  assert(db.envName === 'DATABASE_URL', 'simulateDatabaseUrlRotation envName correct');

  const cf = dr.secretRotationRehearsal.simulateCloudflareTokenRotation({});
  assert(cf.ok, 'simulateCloudflareTokenRotation returns ok');
  assert(cf.envName === 'CLOUDFLARE_API_TOKEN', 'simulateCloudflareTokenRotation envName correct');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
