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
assert(normalized.includes('• Poin satu'));

const telegramPlain = ux.normalizeForTelegram('**🔋 Baterai & Charging**\n- **Baterai**: 4.610 mAh\n- *Note*: charger **tidak disertakan**.\n\n```md\n**tetap di code block**\n```');
assert(!telegramPlain.includes('**Baterai**'));
assert(telegramPlain.includes('🔋 Baterai & Charging'));
assert(telegramPlain.includes('• Baterai: 4.610 mAh'));
assert(telegramPlain.includes('• Note: charger tidak disertakan.'));
assert(telegramPlain.includes('**tetap di code block**'));

console.log('Multi-device UX checks passed.');
