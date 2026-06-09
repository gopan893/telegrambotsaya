'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // getMobileNavigationState
  const state = mobile.mobileNavigationManager.getMobileNavigationState({});
  assert(state !== null, 'getMobileNavigationState returns state');
  assert(Array.isArray(state.tabs), 'tabs is array');
  assert(Array.isArray(state.bottomNav), 'bottomNav is array');
  assert(Array.isArray(state.groups), 'groups is array');

  // buildBottomNavigationItems
  const bottomNav = mobile.mobileNavigationManager.buildBottomNavigationItems({});
  assert(bottomNav.length === 7, 'buildBottomNavigationItems returns 7 items');
  assert(bottomNav[0].id === 'nav-overview', 'first item is nav-overview');
  assert(bottomNav[0].tab === 'overview', 'nav-overview tab is overview');
  assert(bottomNav[0].href.startsWith('/'), 'href starts with /');

  // buildMobileTabGroups
  const groups = mobile.mobileNavigationManager.buildMobileTabGroups({});
  assert(groups.length === 8, 'buildMobileTabGroups returns 8 groups');
  assert(groups[0].id === 'group-core', 'first group is group-core');
  assert(Array.isArray(groups[0].tabs), 'group tabs is array');
  assert(groups[0].tabs.includes('overview'), 'group-core includes overview');

  // validateMobileNavigationItems - valid
  const validItems = [
    { id: 'nav-1', tab: 'overview', href: '/dashboard?tab=overview', dataTab: 'overview' },
    { id: 'nav-2', tab: 'agents', href: '/dashboard?tab=agents', dataTab: 'agents' }
  ];
  const valid = mobile.mobileNavigationManager.validateMobileNavigationItems(validItems, {});
  assert(valid.valid === true, 'valid navigation items pass');

  // validateMobileNavigationItems - duplicate id
  const dupItems = [
    { id: 'nav-dup', tab: 'overview', href: '/dashboard?tab=overview', dataTab: 'overview' },
    { id: 'nav-dup', tab: 'agents', href: '/dashboard?tab=agents', dataTab: 'agents' }
  ];
  const dup = mobile.mobileNavigationManager.validateMobileNavigationItems(dupItems, {});
  assert(dup.valid === false, 'duplicate id fails validation');

  // validateMobileNavigationItems - broken href
  const brokenItems = [
    { id: 'nav-bad', tab: 'overview', href: 'dashboard?tab=overview', dataTab: 'overview' }
  ];
  const broken = mobile.mobileNavigationManager.validateMobileNavigationItems(brokenItems, {});
  assert(broken.valid === false, 'broken href fails validation');

  // ensureKnownTabsHaveMobileRoutes
  const known = mobile.mobileNavigationManager.ensureKnownTabsHaveMobileRoutes({});
  assert(known.allPresent === false, 'ensureKnownTabsHaveMobileRoutes allPresent false (some tabs not in groups)');
  assert(Array.isArray(known.missing), 'missing is array');

  // STABLE_TABS includes important ones
  const stableTabs = mobile.mobileNavigationManager.STABLE_TABS;
  assert(stableTabs.includes('overview'), 'STABLE_TABS includes overview');
  assert(stableTabs.includes('executor'), 'STABLE_TABS includes executor');
  assert(stableTabs.includes('privacy'), 'STABLE_TABS includes privacy');
  assert(stableTabs.includes('rag-kb'), 'STABLE_TABS includes rag-kb');
  assert(stableTabs.includes('recipes'), 'STABLE_TABS includes recipes');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
