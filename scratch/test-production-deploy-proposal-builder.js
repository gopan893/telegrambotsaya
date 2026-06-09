'use strict';

const Builder = require('../src/release/production-deploy-proposal-builder');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

console.log('\n=== Production Deploy Proposal Builder Tests ===\n');

const deployProp = Builder.buildProductionDeployProposal('test123',{});
a(deployProp.proposalType === 'production_deploy','deploy proposal type correct');
a(deployProp.directAction === false,'deploy is not direct action');
a(deployProp.requiresEvaluation === true,'deploy requires Evaluation v2');
a(deployProp.requiresApproval === true,'deploy requires approval');

const renderProp = Builder.buildRenderDeployProposal('test123',{});
a(renderProp.proposalType === 'render_deploy','render proposal type correct');
a(renderProp.directAction === false,'render deploy not direct');
a(renderProp.credentialsConfigured === false,'no hook in empty env');

const smokeTest = Builder.buildDeploySmokeTestPlan('test123',{});
a(smokeTest.tests.length === 8,'8 smoke tests');

const rollbackProp = Builder.buildRollbackProposalIfNeeded('test123','health failure',{});
a(rollbackProp.proposalType === 'rollback','rollback proposal type correct');
a(rollbackProp.directAction === false,'rollback not direct');
a(rollbackProp.reason === 'health failure','rollback reason preserved');

console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
