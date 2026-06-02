'use strict';

const assert = require('assert');
const relevanceGate = require('../src/ai-os/context-relevance-gate');
const outputSanitizer = require('../src/ai-os/output-sanitizer');
const fileIntentGuard = require('../src/multimodal/file-intent-guard');

function testDomainDetection() {
  console.log('Testing Context Domain Detection...');

  assert.strictEqual(relevanceGate.detectConversationDomain('pacarku mutusin aku kemarin dan aku sedih banget'), 'emotional');
  assert.strictEqual(relevanceGate.detectConversationDomain('aku merasa kesepian dan patah hati'), 'emotional');

  assert.strictEqual(relevanceGate.detectConversationDomain('bagaimana cara deploy bot ke render?'), 'project');
  assert.strictEqual(relevanceGate.detectConversationDomain('ada bug di database postgresql di production'), 'project');

  assert.strictEqual(relevanceGate.detectConversationDomain('halo apa kabar?'), 'general');

  console.log('✅ Domain detection test passed.');
}

function testMemoryScoring() {
  console.log('Testing Memory Relevance Scoring...');

  const projectMemory = {
    type: 'project',
    content: 'User deploy bot ke Render di Phase 9'
  };

  const emotionalMemory = {
    type: 'emotional',
    content: 'User merasa sedih setelah putus dengan pacarnya'
  };

  const scoreProjInEmo = relevanceGate.scoreContextRelevance('aku sedih banget pacarku putus', projectMemory);
  assert.strictEqual(scoreProjInEmo, 0);

  const scoreEmoInEmo = relevanceGate.scoreContextRelevance('aku sedih banget pacarku putus', emotionalMemory);
  assert.ok(scoreEmoInEmo >= 0.7);

  const scoreProjInProj = relevanceGate.scoreContextRelevance('bagaimana deploy database?', projectMemory);
  assert.ok(scoreProjInProj >= 0.7);

  console.log('✅ Memory scoring test passed.');
}

function testContextFiltering() {
  console.log('Testing Context Filtering...');

  const context = [
    { type: 'project', content: 'User deploy bot ke Render di Phase 9' },
    { type: 'emotional', content: 'User merasa sedih setelah putus' },
    { type: 'general', content: 'User menyukai kopi susu gula aren' }
  ];

  const emotionalFiltered = relevanceGate.filterRelevantContext('aku rindu dia', context);

  const containsProj = emotionalFiltered.some(item => item.type === 'project');
  assert.strictEqual(containsProj, false);

  const containsEmo = emotionalFiltered.some(item => item.type === 'emotional');
  assert.strictEqual(containsEmo, true);

  console.log('✅ Context filtering test passed.');
}

function testOutputSanitization() {
  console.log('Testing Output Sanitizer...');

  const rawText1 = 'Logika internal saya mendeteksi kontradiksi dalam database.';
  const sanitized1 = outputSanitizer.sanitizeAssistantVisibleText(rawText1);
  assert.strictEqual(sanitized1, 'pemikiranku tadi sempat kurang tepat dalam database.');

  const rawText2 = '[internal] User sedang sedih.\n[debug] Membuka emotional support.';
  const sanitized2 = outputSanitizer.sanitizeAssistantVisibleText(rawText2);
  assert.strictEqual(sanitized2, 'User sedang sedih.\nMembuka emotional support.');

  const rawText3 = 'Aku turut prihatin. Berdasarkan target minggu ini dan deploy terakhir, aku akan selalu bersamamu.';
  const sanitized3 = outputSanitizer.sanitizeAssistantVisibleText(rawText3);
  assert.strictEqual(sanitized3, 'Aku turut prihatin. , aku akan selalu bersamamu.');

  const adminText = '/diag status';
  const rawAdminResponse = '[debug] RSS 45MB.';
  const sanitizedAdmin = outputSanitizer.sanitizeAssistantVisibleText(rawAdminResponse, { isAdmin: true, userText: adminText });
  assert.strictEqual(sanitizedAdmin, rawAdminResponse);

  const roadmapText = 'Menurut saya lanjut ke Phase 22.';
  const roadmapSanitized = outputSanitizer.sanitizeAssistantVisibleText(roadmapText, {
    userText: 'saya bingung lanjut phase berapa'
  });
  assert.ok(/Phase 22/.test(roadmapSanitized));

  console.log('✅ Output sanitization test passed.');
}

function testFileIntentGuard() {
  console.log('Testing File Intent Guard...');

  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('apa langkah selanjutnya'), false);
  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('lanjut phase berapa'), false);
  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('bot error deploy'), false);
  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('saya capek hari ini'), false);
  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('analisis gambar tadi'), true);
  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('isi file ini apa?'), true);
  assert.strictEqual(fileIntentGuard.isFileRelatedMessage('', { hasAttachment: true }), true);
  assert.strictEqual(fileIntentGuard.shouldUseRecentFileContext('gambar tadi maksudnya apa?'), true);
  assert.strictEqual(fileIntentGuard.shouldUseRecentFileContext('buat prompt roadmap'), false);

  console.log('✅ File intent guard test passed.');
}

function runAll() {
  testDomainDetection();
  testMemoryScoring();
  testContextFiltering();
  testOutputSanitization();
  testFileIntentGuard();
  console.log('🎉 All Context Relevance & Sanitization tests passed successfully!');
}

runAll();
