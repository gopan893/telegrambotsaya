'use strict';

const SloRegistry = require('../src/reliability/slo-registry');

let p=0, f=0;
function a(c,l){if(c){p++;console.log('  PASS: '+l)}else{f++;console.log('  FAIL: '+l)}}

SloRegistry.resetStore();
console.log('\n=== SLO Registry Tests ===\n');

const initialized = SloRegistry.initializeDefaultSlos();
a(initialized.length === 12,'12 default SLOs');
a(initialized[0].id && initialized[0].name,'SLO has id and name');
a(initialized[0].target > 0,'SLO has target');

const all = SloRegistry.listSlos({enabled:true});
a(all.length === 12,'list enabled returns 12');

const byModule = SloRegistry.listSlos({module:'security'});
a(byModule.length >= 1,'list by module works');

const slo = SloRegistry.getSlo(initialized[0].id);
a(slo && slo.name === initialized[0].name,'getSlo works');

const custom = SloRegistry.addCustomSlo({name:'test_slo',target:95});
a(custom.name === 'test_slo','custom SLO created');
a(custom.target === 95,'custom SLO target');

const updated = SloRegistry.updateSlo(initialized[0].id, {target:99.9});
a(updated.target === 99.9,'updateSlo works');

SloRegistry.resetStore();
console.log('\nResult: '+p+' PASS, '+f+' FAIL\n');
process.exit(f>0?1:0);
