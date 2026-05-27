'use strict';

const assert = require('assert');
const safety = require('../src/ux/human-ai-safety');

assert.equal(safety.isHighStakes('Bagaimana memilih investasi saham?'), true);
assert.equal(safety.isHighStakes('Buat roadmap belajar backend'), false);

const note = safety.buildContextNote('Saya punya masalah hukum kontrak');
assert(note.includes('HIGH-STAKES'));
assert(note.includes('verifikasi'));

const withFooter = safety.applyHumanJudgmentFooter('Ini analisis opsi investasi.', 'investasi crypto');
assert(withFooter.includes('bukan keputusan final'));

const withoutFooter = safety.applyHumanJudgmentFooter('Ini roadmap belajar.', 'belajar backend');
assert.equal(withoutFooter, 'Ini roadmap belajar.');

console.log('Human-AI safety checks passed.');
