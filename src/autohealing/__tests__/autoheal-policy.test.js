'use strict';

const policy = require('../autoheal-policy');

test.each([
  [{ enabled: true, level: 'L1' }, true],
  [{ enabled: false, level: 'L1' }, false],
  [{ enabled: true, level: 'L0' }, false],
  [{ enabled: true, level: 'L3' }, false],
  [{ enabled: true, level: 'L2' }, false],
])('auto-heal policy for %o is %s', (action, expected) => {
  expect(policy.canRunAutoHeal(action, {}).ok).toBe(expected);
});
