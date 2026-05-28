'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const collaboration = require('../src/collaboration');
const { createStorageManager } = require('../src/storage');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-mvp-'));
  const storageManager = createStorageManager({
    env: { DATABASE_URL: '', REDIS_URL: '', STORAGE_DRIVER: 'auto' },
    jsonBaseDir: dir
  });
  await storageManager.initStorage();

  const users = {};
  const services = {
    storageManager,
    ensureUser(userId) {
      const id = String(userId);
      if (!users[id]) users[id] = { mode: 'auto', adaptive: { enabled: true } };
      return users[id];
    },
    persist() {}
  };

  const userId = 'collab-user';
  const user = services.ensureUser(userId);
  const cases = [
    ['/think', 'Saya bingung mulai dari mana membangun bot AI ini', /Thinking Partner/],
    ['/strategy', 'Bagaimana membuat bot ini jadi produk serius?', /Analisis Strategis/],
    ['/reflect', 'Saya sulit konsisten belajar coding', /Reflection/],
    ['/learnplan', 'backend Node.js dari nol', /Learning Mentor/],
    ['/mentalmodel', 'memilih database untuk memory AI', /Mental Model Builder/],
    ['/decision', 'Pilih PostgreSQL atau Redis untuk memory jangka panjang', /Decision Support/],
    ['/blindspot', 'Roadmap saya terlalu banyak fitur AI', /Blind Spot Analysis/],
    ['/assumptions', 'Bot AI ini otomatis jadi produk sukses', /Fact \/ Assumption \/ Opinion/],
    ['/perspectives', 'Membuat AI bot untuk pengguna umum', /Multi-Perspective Analysis/],
    ['/insight', 'Dari project ini apa pola penting yang terlihat?', /Insight Generator/],
    ['/journal', 'Hari ini saya menyelesaikan adaptive mode router', /Reflection/],
    ['/collab', '', /Human-AI Collaboration/]
  ];

  for (const [command, text, pattern] of cases) {
    const response = await collaboration.respond(command, text, userId, user, services);
    assert.match(response, pattern, command);
  }

  const prompt = await collaboration.respond('/journal', '', userId, user, services);
  assert.match(prompt, /Journal Reflection/);

  const stored = await storageManager.loadData('collaboration_state', {});
  assert.ok(stored[userId].analytics.sessions >= 10);
  assert.ok(stored[userId].insights.length > 0);

  await storageManager.closeStorage();
  console.log('collaboration mvp checks passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
