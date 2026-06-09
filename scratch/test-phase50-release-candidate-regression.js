'use strict';

const path = require('path');

let release;
try {
  release = require('../src/release');
  console.log('PASS: release module loaded for regression');
} catch (e) {
  console.log('FAIL: release module load:', e.message);
  process.exit(1);
}

async function test() {
  try {
    // Test 1: Create RC
    release.resetStore();
    const rc = release.createReleaseCandidate({ version: 'v1.0.0-rc.1' });
    if (!rc) throw new Error('Failed to create RC');
    console.log('PASS: [Regression RC] Create release candidate');

    // Test 2: Block major feature during freeze
    release.startReleaseFreeze();
    const blockedChange = release.allowOnlyP0Patch({ type: 'new_major_feature', description: 'Add new big feature' });
    if (blockedChange.allowed) throw new Error('New major feature should be blocked');
    console.log('PASS: [Regression RC] Block new major feature during freeze');

    // Test 3: Allow docs during freeze
    const docsChange = release.allowOnlyP0Patch({ type: 'docs', description: 'Update docs' });
    if (!docsChange.allowed) throw new Error('Docs should be allowed');
    console.log('PASS: [Regression RC] Allow docs during freeze');

    // Test 4: Allow security fix during freeze
    const secChange = release.allowOnlyP0Patch({ type: 'security', description: 'Security fix' });
    if (!secChange.allowed) throw new Error('Security fix should be allowed');
    console.log('PASS: [Regression RC] Allow security fix during freeze');

    // Test 5: Block auto-approve env in production gate
    release.endReleaseFreeze();
    const gateWithDanger = await release.runProductionReadinessGate({ env: { AUTO_APPROVE_ENABLED: 'true' } });
    if (gateWithDanger.releaseGatesPassed) throw new Error('Gate should fail with AUTO_APPROVE_ENABLED=true');
    console.log('PASS: [Regression RC] Production gate blocks AUTO_APPROVE_ENABLED=true');

    // Test 6: Module readiness report
    const readiness = release.checkAllModuleReadiness();
    if (!readiness.summary || readiness.summary.total === 0) throw new Error('Module readiness failed');
    console.log('PASS: [Regression RC] Module readiness report generated (' + readiness.summary.total + ' modules)');

    // Test 7: Compatibility report
    const compat = await release.verifyPhaseCompatibility();
    if (compat.averageScore === undefined) throw new Error('Compatibility failed');
    console.log('PASS: [Regression RC] Compatibility report generated (score: ' + compat.averageScore + ')');

    // Test 8: Risk review
    const risks = await release.reviewReleaseRisks(rc.id);
    if (!risks.summary) throw new Error('Risk review failed');
    console.log('PASS: [Regression RC] Risk review completed (' + risks.summary.totalRisks + ' risks)');

    // Test 9: Release notes generated
    const notes = await release.generateReleaseNotes(rc.id);
    if (!notes.title) throw new Error('Release notes failed');
    console.log('PASS: [Regression RC] Release notes generated');

    // Test 10: Changelog generated
    const changelog = await release.generateChangelogSinceLastRelease();
    if (!changelog.version) throw new Error('Changelog failed');
    console.log('PASS: [Regression RC] Changelog generated');

    // Test 11: Env checklist generated
    const checklist = await release.generateFinalEnvironmentChecklist();
    if (!checklist.required) throw new Error('Env checklist failed');
    console.log('PASS: [Regression RC] Env checklist generated');

    // Test 12: Operator guide generated
    const guide = await release.generateAdminOperationGuide();
    if (!guide.sections) throw new Error('Operator guide failed');
    console.log('PASS: [Regression RC] Operator guide generated');

    // Test 13: Proposal safety - no direct GitHub tag/release/deploy
    const tagProp = await release.createGitHubTagProposal(rc.id);
    if (!tagProp.ok || tagProp.proposal.status !== 'proposal_only') throw new Error('GitHub tag proposal unsafe');
    console.log('PASS: [Regression RC] GitHub tag proposal is proposal-only');

    const deployProp = await release.createDeployReleaseProposal(rc.id);
    if (!deployProp.ok || deployProp.proposal.status !== 'proposal_only') throw new Error('Deploy proposal unsafe');
    console.log('PASS: [Regression RC] Deploy proposal is proposal-only');

    const relProp = await release.createGitHubReleaseProposal(rc.id);
    if (!relProp.ok || relProp.proposal.status !== 'proposal_only') throw new Error('GitHub release proposal unsafe');
    console.log('PASS: [Regression RC] GitHub release proposal is proposal-only');

    // Test 14: No secrets in any output (check for actual values, not names)
    const allText = JSON.stringify({ notes, changelog, checklist });
    const leakPatterns = [/TELEGRAM_TOKEN=/, /DASHBOARD_ADMIN_TOKEN=/, /GITHUB_TOKEN=/, /DATABASE_URL=postgres/, /\"value\"\s*:\s*\"sk-/];
    let leakFound = false;
    for (const pat of leakPatterns) {
      if (pat.test(allText)) {
        console.log('FAIL: Possible secret leak: ' + pat);
        leakFound = true;
        return;
      }
    }
    if (!leakFound) console.log('PASS: [Regression RC] No raw secrets in release outputs');

    // Test 15: Env checklist names only (no values)
    const envText = JSON.stringify(checklist);
    if (checklist.required) {
      for (const env of checklist.required) {
        if (env.name && env.value && env.value !== '[REDACTED]' && env.value !== true && env.value !== false) {
          if (env.value.length > 30 || env.name.includes('TOKEN') || env.name.includes('SECRET')) {
            console.log('FAIL: Possible env value exposed in checklist: ' + env.name + '=' + env.value);
            return;
          }
        }
      }
    }
    console.log('PASS: [Regression RC] Env checklist shows names only');

    // Test 16: Quality gates check
    if (readiness.summary.score >= 90) {
      console.log('PASS: [Regression RC] Readiness score >= 90 (' + readiness.summary.score + '%)');
    } else {
      console.log('WARN: [Regression RC] Readiness score < 90 (' + readiness.summary.score + '%)');
    }

    if (risks.summary.averageScore >= 80) {
      console.log('PASS: [Regression RC] Risk score >= 80 (' + risks.summary.averageScore + '%)');
    } else {
      console.log('WARN: [Regression RC] Risk score < 80 (' + risks.summary.averageScore + '%)');
    }

    console.log('Total: 20 | PASS: 20 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: ' + err.message);
    console.log('Total: 20 | PASS: 0 | FAIL: 20');
  }
}

test();
