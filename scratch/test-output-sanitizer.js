'use strict';

const assert = require('assert');
const sanitizer = require('../src/ai-os/output-sanitizer');

const leaked = [
  'Jawaban roadmap normal.',
  '',
  'Catatan: confidence analisis file rendah. Bagian tertentu mungkin tidak terbaca jelas.',
  '',
  'Sumber file: photo.jpg#visual-analysis.',
  '',
  'Batasan analisis: API Vision belum dikonfigurasi. Analisis berbasis metadata saja.'
].join('\n');

const cleaned = sanitizer.sanitizeAssistantVisibleText(leaked, {
  userText: 'apa langkah selanjutnya',
  fileRelated: false,
  forceClean: true
});

assert.ok(!cleaned.includes('#visual-analysis'), 'normal reply must strip visual-analysis source');
assert.ok(!/Sumber file:/i.test(cleaned), 'normal reply must strip source file line');
assert.ok(!/API Vision belum dikonfigurasi/i.test(cleaned), 'normal reply must strip vision limitation');
assert.ok(cleaned.includes('Jawaban roadmap normal.'), 'normal answer body should remain');

const kept = sanitizer.sanitizeAssistantVisibleText(leaked, {
  userText: 'analisis gambar tadi',
  fileRelated: true,
  forceClean: true
});

assert.ok(kept.includes('#visual-analysis'), 'file-related reply may keep visual-analysis source');
assert.ok(/API Vision belum dikonfigurasi/i.test(kept), 'file-related reply may keep vision limitation');

console.log('test-output-sanitizer: ok');
