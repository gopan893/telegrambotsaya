'use strict';

const Builder = require('../src/release/github-release-proposal-builder');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== GitHub Release Proposal Builder Tests ===\n');

const tagProp = Builder.buildGitHubTagProposal('test123',{});
a(tagProp.proposalType === 'github_tag','tag proposal type correct');
a(tagProp.directAction === false,'tag proposal is not direct action');
a(tagProp.requiresEvaluation === true,'tag requires Evaluation v2');
a(tagProp.requiresApproval === true,'tag requires approval');
a(tagProp.credentialsConfigured === false,'no credentials in empty env');

const relProp = Builder.buildGitHubReleaseProposal('test123',{env:{GITHUB_TOKEN:'x',GITHUB_REPO:'y',GITHUB_OWNER:'z'}});
a(relProp.proposalType === 'github_release','release proposal type correct');
a(relProp.directAction === false,'release proposal not direct');
a(relProp.credentialsConfigured === true,'credentials detected');

const notes = Builder.buildReleaseNotesForGitHub('test123',{});
a(notes && notes.version === 'v1.0.0','notes have version');
a(notes.highlights.length >= 10,'notes have 10+ highlights');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
