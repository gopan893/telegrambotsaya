'use strict';

const assert = require('assert');
const relevanceGate = require('../src/ai-os/context-relevance-gate');
const outputSanitizer = require('../src/ai-os/output-sanitizer');

function testDomainDetection() {
  console.log('Testing Context Domain Detection...');
  
  // Emotional inputs
  assert.strictEqual(relevanceGate.detectConversationDomain('pacarku mutusin aku kemarin dan aku sedih banget'), 'emotional');
  assert.strictEqual(relevanceGate.detectConversationDomain('aku merasa kesepian dan patah hati'), 'emotional');
  
  // Project/Technical inputs
  assert.strictEqual(relevanceGate.detectConversationDomain('bagaimana cara deploy bot ke render?'), 'project');
  assert.strictEqual(relevanceGate.detectConversationDomain('ada bug di database postgresql di production'), 'project');
  
  // General fallback
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
  
  // In emotional domain: project memories must score 0
  const scoreProjInEmo = relevanceGate.scoreContextRelevance('aku sedih banget pacarku putus', projectMemory);
  assert.strictEqual(scoreProjInEmo, 0);
  
  // In emotional domain: emotional memories should score high
  const scoreEmoInEmo = relevanceGate.scoreContextRelevance('aku sedih banget pacarku putus', emotionalMemory);
  assert.ok(scoreEmoInEmo >= 0.7);
  
  // In project domain: project memories should score high
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
  
  // Should NOT contain the project memory
  const containsProj = emotionalFiltered.some(item => item.type === 'project');
  assert.strictEqual(containsProj, false);
  
  // Should contain the emotional memory
  const containsEmo = emotionalFiltered.some(item => item.type === 'emotional');
  assert.strictEqual(containsEmo, true);
  
  console.log('✅ Context filtering test passed.');
}

function testOutputSanitization() {
  console.log('Testing Output Sanitizer...');
  
  // Internal debug language
  const rawText1 = 'Logika internal saya mendeteksi kontradiksi dalam database.';
  const sanitized1 = outputSanitizer.sanitizeAssistantVisibleText(rawText1);
  assert.strictEqual(sanitized1, 'pemikiranku tadi sempat kurang tepat dalam database.');
  
  // Annotations
  const rawText2 = '[internal] User sedang sedih.\n[debug] Membuka emotional support.';
  const sanitized2 = outputSanitizer.sanitizeAssistantVisibleText(rawText2);
  assert.strictEqual(sanitized2, 'User sedang sedih.\nMembuka emotional support.');
  
  // Leakage of project context
  const rawText3 = 'Aku turut prihatin. Berdasarkan target minggu ini dan deploy terakhir, aku akan selalu bersamamu.';
  const sanitized3 = outputSanitizer.sanitizeAssistantVisibleText(rawText3);
  assert.strictEqual(sanitized3, 'Aku turut prihatin. , aku akan selalu bersamamu.');
  
  // Admin bypass
  const adminText = '/diag status';
  const rawAdminResponse = '[debug] RSS 45MB.';
  const sanitizedAdmin = outputSanitizer.sanitizeAssistantVisibleText(rawAdminResponse, { isAdmin: true, userText: adminText });
  assert.strictEqual(sanitizedAdmin, rawAdminResponse); // should not be stripped for admins running debug commands
  
  console.log('✅ Output sanitization test passed.');
}

function runAll() {
  testDomainDetection();
  testMemoryScoring();
  testContextFiltering();
  testOutputSanitization();
  console.log('🎉 All Context Relevance & Sanitization tests passed successfully!');
}

runAll();
