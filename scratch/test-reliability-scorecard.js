'use strict';

const Scorecard = require('../src/reliability/reliability-scorecard');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Reliability Scorecard Tests ===\n');

const sc = Scorecard.calculateReliabilityScorecard({});
a(sc && sc.overall >= 95,'overall score >= 95 in clean env');
a(sc.level === 'production_stable','level production_stable');
a(sc.scores && sc.scores.dashboard === 100,'dashboard score 100');
a(sc.scores.approvalSafety === 100,'approval safety score 100');

const scDangerous = Scorecard.calculateReliabilityScorecard({env:{AUTO_APPROVE_ENABLED:'true'}});
a(scDangerous.scores.approvalSafety === 0,'approval safety 0 with auto-approve');
a(scDangerous.level === 'needs_attention','level needs_attention with auto-approve (score 80)');

const postRelease = Scorecard.calculatePostReleaseReliability('rel_test', {});
a(postRelease.score === 100,'post-release score 100');
a(postRelease.level === 'production_stable','post-release level');

a(Scorecard.scoreToLevel(95) === 'production_stable','95 -> production_stable');
a(Scorecard.scoreToLevel(85) === 'acceptable','85 -> acceptable');
a(Scorecard.scoreToLevel(70) === 'needs_attention','70 -> needs_attention');
a(Scorecard.scoreToLevel(50) === 'block_next_release','50 -> block_next_release');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
