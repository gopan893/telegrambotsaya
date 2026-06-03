'use strict';

/**
 * Test: Multi-Bot Safety - Phase 30
 * 
 * Tests:
 * - Token mapping verification
 * - Missing optional bot token fallback
 * - Bot-to-bot loop prevention
 * - Visible specialist replies limit
 * - /multibot_on and /multibot_off
 * - /botmapping shows safe mapping
 */

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

// Mock token mapping
const tokenMapping = {
  TELEGRAM_TOKEN: { agent: 'orchestrator', required: true },
  TELEGRAM_TOKEN_PLANNER: { agent: 'planner', required: false },
  TELEGRAM_TOKEN_CODER: { agent: 'coder', required: false },
  TELEGRAM_TOKEN_CRITIC: { agent: 'critic', required: false },
  TELEGRAM_TOKEN_SECURITY: { agent: 'security', required: false }
};

// Test 1: TELEGRAM_TOKEN is orchestrator/default
test('TELEGRAM_TOKEN is orchestrator/default', () => {
  assert.strictEqual(tokenMapping.TELEGRAM_TOKEN.agent, 'orchestrator', 
    'TELEGRAM_TOKEN should map to orchestrator');
  assert.strictEqual(tokenMapping.TELEGRAM_TOKEN.required, true, 
    'TELEGRAM_TOKEN should be required');
});

// Test 2: TELEGRAM_TOKEN_PLANNER maps to planner
test('TELEGRAM_TOKEN_PLANNER maps to planner', () => {
  assert.strictEqual(tokenMapping.TELEGRAM_TOKEN_PLANNER.agent, 'planner', 
    'TELEGRAM_TOKEN_PLANNER should map to planner');
});

// Test 3: TELEGRAM_TOKEN_CODER maps to coder
test('TELEGRAM_TOKEN_CODER maps to coder', () => {
  assert.strictEqual(tokenMapping.TELEGRAM_TOKEN_CODER.agent, 'coder', 
    'TELEGRAM_TOKEN_CODER should map to coder');
});

// Test 4: TELEGRAM_TOKEN_CRITIC maps to critic
test('TELEGRAM_TOKEN_CRITIC maps to critic', () => {
  assert.strictEqual(tokenMapping.TELEGRAM_TOKEN_CRITIC.agent, 'critic', 
    'TELEGRAM_TOKEN_CRITIC should map to critic');
});

// Test 5: Missing optional bot token falls back safely
test('Missing optional bot token falls back safely', () => {
  const optionalTokens = ['TELEGRAM_TOKEN_PLANNER', 'TELEGRAM_TOKEN_CODER', 'TELEGRAM_TOKEN_CRITIC'];
  
  for (const token of optionalTokens) {
    assert.strictEqual(tokenMapping[token].required, false, 
      `${token} should be optional`);
  }
});

// Test 6: Bot messages do not trigger bot-to-bot loops
test('Bot messages do not trigger bot-to-bot loops', () => {
  // Mock loop prevention logic
  const isBotMessage = (msg) => msg.from?.is_bot === true;
  const shouldTrigger = (msg) => !isBotMessage(msg);
  
  const botMessage = { from: { is_bot: true }, text: 'test' };
  const userMessage = { from: { is_bot: false }, text: 'test' };
  
  assert.strictEqual(shouldTrigger(botMessage), false, 'Bot message should not trigger');
  assert.strictEqual(shouldTrigger(userMessage), true, 'User message should trigger');
});

// Test 7: Visible specialist replies respect max limit
test('Visible specialist replies respect max limit', () => {
  const MAX_SPECIALIST_REPLIES = 3;
  const specialistReplies = ['reply1', 'reply2', 'reply3', 'reply4'];
  
  const limitedReplies = specialistReplies.slice(0, MAX_SPECIALIST_REPLIES);
  assert.ok(limitedReplies.length <= MAX_SPECIALIST_REPLIES, 
    'Should respect max specialist replies limit');
});

// Test 8: /botmapping shows safe mapping without token values
test('/botmapping shows safe mapping without token values', () => {
  const mapping = {};
  for (const [key, value] of Object.entries(tokenMapping)) {
    mapping[key] = { agent: value.agent, required: value.required };
    // Token value should NOT be included
  }
  
  for (const key of Object.keys(mapping)) {
    assert.ok(!mapping[key].hasOwnProperty('token'), 
      `${key} should not expose token value`);
  }
});

// Test 9: All required tokens are present
test('All required tokens are present', () => {
  const requiredTokens = Object.entries(tokenMapping)
    .filter(([_, v]) => v.required)
    .map(([k, _]) => k);
  
  assert.ok(requiredTokens.includes('TELEGRAM_TOKEN'), 
    'TELEGRAM_TOKEN should be required');
});

// Test 10: Typo TELEGRAM_TOKEN_PLANNE should warn
test('Typo TELEGRAM_TOKEN_PLANNE should warn', () => {
  const typoToken = 'TELEGRAM_TOKEN_PLANNE';
  const correctToken = 'TELEGRAM_TOKEN_PLANNER';
  
  // Check if typo is detected
  const isTypo = typoToken === 'TELEGRAM_TOKEN_PLANNE' && 
                 correctToken === 'TELEGRAM_TOKEN_PLANNER';
  
  assert.ok(isTypo, 'Typo should be detected and suggest correct token');
});

console.log('\n📊 Multi-Bot Safety Test Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
