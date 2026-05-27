'use strict';

const assert = require('assert');
const ux = require('../src/ux/multi-device-response');

const promptRules = ux.getPromptRules();
assert(promptRules.includes('Aturan UX multi-device'));
assert(promptRules.includes('paragraf pendek'));
assert(promptRules.includes('code block'));

const compactHint = ux.getCompactPromptHint();
assert(compactHint.includes('Mobile-friendly'));
assert(compactHint.includes('Inti dulu'));

const normalized = ux.normalizeForTelegram('Ringkasan   utama  \n\n\n\n- Poin satu  \n\n```js\nconst x = 1;  \n```\n');
assert(!normalized.includes('\n\n\n\n'));
assert(normalized.includes('Ringkasan'));
assert(normalized.includes('```js'));
assert(normalized.includes('const x = 1;'));

console.log('Multi-device UX checks passed.');
