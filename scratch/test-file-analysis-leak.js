'use strict';

const assert = require('assert');
const agents = require('../src/agents');
const sanitizer = require('../src/ai-os/output-sanitizer');

const stale = 'Planner: lanjut phase berikutnya.\n\nSumber file: photo.jpg#visual-analysis.\n\nBatasan analisis: API Vision belum dikonfigurasi. Analisis berbasis metadata saja.';

const normal = agents.agentResponseRenderer.renderFinalSynthesis({
  text: stale
}, [], {
  text: 'saya bingung lanjut phase berapa',
  topics: ['planning'],
  route: { topics: ['planning'], selectedAgents: ['orchestrator', 'planner'], approvalRequired: false }
});
assert.ok(!normal.includes('#visual-analysis'), 'council/natural synthesis must strip stale visual source');
assert.ok(!/API Vision belum dikonfigurasi/i.test(normal), 'council/natural synthesis must strip stale vision limitation');

const specialist = sanitizer.sanitizeAssistantVisibleText(stale, {
  userText: 'bot saya error deploy',
  fileRelated: false,
  forceClean: true
});
assert.ok(!/Sumber file:/i.test(specialist), 'specialist reply must strip stale source file');

const fileRelated = sanitizer.sanitizeAssistantVisibleText(stale, {
  userText: 'gambar tadi maksudnya apa?',
  fileRelated: true,
  forceClean: true
});
assert.ok(/Sumber file:/i.test(fileRelated), 'file-related question may keep file source');

console.log('test-file-analysis-leak: ok');
