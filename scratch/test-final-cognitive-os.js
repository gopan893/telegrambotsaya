'use strict';

const assert = require('assert');
const adaptive = require('../src/adaptive');
const collaboration = require('../src/collaboration');
const { createStorageManager } = require('../src/storage');

const user = {
  mode: 'auto',
  manualModeOverride: false,
  adaptive: { enabled: true },
  tags: ['backend'],
  preferences: {}
};

const decision = adaptive.route({
  text: 'Saya bingung pilih Redis atau PostgreSQL untuk memory bot',
  user,
  aiOSStatus: { activeGoals: 1, activeWorkflows: 1 }
});

assert(decision.applied);
assert(['decision-support', 'strategic-thinking', 'system-analysis', 'auto'].includes(decision.mode));
assert(user.adaptive.activeMode);

const think = collaboration.respond('/think', 'Bagaimana mengembangkan bot AI tanpa terlalu kompleks?', 'u1', user);
assert(think.includes('Thinking Partner'));

const learning = collaboration.respond('/learnplan', 'backend dari nol', 'u1', user);
assert(learning.includes('Roadmap'));

const insight = collaboration.respond('/insight', 'Mulai dari baseline sebelum optimasi', 'u1', user);
assert(insight.includes('Insight tersimpan'));

const manager = createStorageManager({
  env: {},
  jsonBaseDir: process.cwd()
});

assert(manager.status().persistentType === 'json');

console.log('Final cognitive OS smoke test passed');
