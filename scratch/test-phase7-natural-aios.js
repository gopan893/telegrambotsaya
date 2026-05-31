'use strict';

const assert = require('assert');
const naturalAIOS = require('../src/ai-os/natural-integration');

async function run() {
  assert.strictEqual(
    naturalAIOS.detectAIOSNaturalNeed('Apa langkah berikutnya untuk project bot saya?').needed,
    true,
    'project next action should trigger AI OS natural context'
  );

  assert.strictEqual(
    naturalAIOS.detectAIOSNaturalNeed('Halo').needed,
    false,
    'simple greeting should not trigger AI OS'
  );

  assert.strictEqual(
    naturalAIOS.detectAIOSNaturalNeed('25*4').needed,
    false,
    'simple math should not trigger AI OS'
  );

  const emptyContext = await naturalAIOS.buildNaturalAIOSContext('phase7-user', 'Apa langkah berikutnya?', {
    aiOS: {
      contextSync: {
        async buildAIOSContext(userId) {
          return {
            userId,
            relevantMemory: [],
            activeGoals: [],
            activeWorkflows: [],
            recentInsights: [],
            summaryText: '-'
          };
        }
      }
    }
  });

  assert.deepStrictEqual(emptyContext.activeGoals, [], 'empty context builder should not crash');

  const sent = [];
  const handled = await naturalAIOS.answerWithAIOSContext(
    'phase7-user',
    123,
    'Apa langkah berikutnya untuk project bot saya?',
    { message_id: 1 },
    {
      aiOS: {
        contextSync: {
          async buildAIOSContext() {
            return {
              relevantMemory: [{ content: 'User sedang membangun Telegram AI Bot production.' }],
              activeGoals: [{ title: 'Stabilkan AI bot', priority: 'high', progress: 0.4 }],
              activeWorkflows: [{
                title: 'Audit Render deploy',
                status: 'active',
                steps: [{ title: 'Test command Telegram', text: 'Test command Telegram', done: false }]
              }],
              recentInsights: [{ content: 'Stabilitas lebih penting daripada fitur baru.' }],
              summaryText: 'context ok'
            };
          }
        }
      },
      sendChunkedMessage: async (chatId, text) => {
        sent.push({ chatId, text });
        return true;
      }
    }
  );

  assert.strictEqual(handled.handled, true, 'AI OS context answer should handle useful context');
  assert.strictEqual(sent.length, 1, 'AI OS answer should send one response');
  assert.ok(/Langkah berikutnya|Workflow|Goal/i.test(sent[0].text), 'answer should use project context');

  const fallback = await naturalAIOS.answerWithAIOSContext(
    'phase7-user',
    123,
    'Halo',
    { message_id: 2 },
    {
      sendChunkedMessage: async () => {
        throw new Error('should not send for greeting');
      }
    }
  );
  assert.strictEqual(fallback.handled, false, 'greeting should fall back to normal chat');

  console.log('Phase 7 natural AI OS checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
