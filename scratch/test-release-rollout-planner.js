'use strict';

const Planner = require('../src/release/release-rollout-planner');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Release Rollout Planner Tests ===\n');

const plan = Planner.createReleaseRolloutPlan('test123',{});
a(plan && plan.releaseId === 'test123','plan has releaseId');
a(plan.stages.length === 8,'8 rollout stages');

const preDeploy = Planner.createPreDeployChecklist('test123',{});
a(preDeploy.items.length === 10,'10 pre-deploy checks');

const verify = Planner.createDeployVerificationChecklist('test123',{});
a(verify.items.length === 8,'8 deploy verification checks');

const rollback = Planner.createRollbackRehearsalPlan('test123',{});
a(rollback.steps.length === 8,'8 rollback steps');
a(rollback.note.includes('proposal + approval'),'rollback is proposal-only');

const postMonitor = Planner.createPostReleaseMonitoringPlan('test123',{});
a(postMonitor.windows.length === 3,'3 monitoring windows');
a(postMonitor.windows[0].duration === '30 minutes','first window 30 minutes');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
