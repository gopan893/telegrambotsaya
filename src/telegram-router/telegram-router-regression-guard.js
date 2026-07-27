'use strict';

const intentClassifier = require('./telegram-intent-classifier');
const riskDetector = require('./telegram-risk-detector');

const TEST_CASES = [
  { text: 'halo', expectedDomain: 'normal_chat', expectedRisk: false },
  { text: 'saya capek hari ini', expectedDomain: 'normal_chat', expectedRisk: false },
  { text: 'jelaskan dengan sederhana', expectedDomain: 'normal_chat', expectedRisk: false },
  { text: 'buat prompt codex', expectedDomain: 'coding', expectedRisk: false },
  { text: 'cek error di telebot.js', expectedDomain: 'coding', expectedRisk: false },
  { text: 'buat test untuk budget token', expectedDomain: 'coding', expectedRisk: false },
  { text: 'roadmap selanjutnya', expectedDomain: 'project', expectedRisk: false },
  { text: 'apa blocker project saya?', expectedDomain: 'project', expectedRisk: false },
  { text: 'deploy sekarang', expectedDomain: 'deploy', expectedRisk: true },
  { text: 'rollback render', expectedDomain: 'deploy', expectedRisk: true },
  { text: 'cek token bocor', expectedDomain: 'security', expectedRisk: false },
  { text: 'audit log security', expectedDomain: 'security', expectedRisk: false },
  { text: 'hapus memory pribadi', expectedDomain: 'privacy', expectedRisk: true },
  { text: 'export data saya', expectedDomain: 'privacy', expectedRisk: true },
  { text: 'buat workflow kalau test gagal', expectedDomain: 'workflow', expectedRisk: false },
  { text: 'cek Termux node', expectedDomain: 'device', expectedRisk: false },
  { text: 'restart Mac sekarang', expectedDomain: 'device', expectedRisk: true },
  { text: 'approve proposal 123', expectedDomain: 'approval', expectedRisk: true },
  { text: 'tampilkan GITHUB_TOKEN', expectedDomain: 'ops', expectedRisk: true },
  { text: 'approve semua proposal otomatis', expectedDomain: 'approval', expectedRisk: true },
  { text: 'kenapa bot error?', expectedDomain: 'troubleshooting', expectedRisk: false },
  { text: 'biaya token mahal', expectedDomain: 'cost', expectedRisk: false },
  { text: 'bandingkan harga AI', expectedDomain: 'research', expectedRisk: false }
];

function runRegression() {
  const results = [];
  for (const tc of TEST_CASES) {
    const intent = intentClassifier.classifyTelegramIntent(tc.text);
    const risk = riskDetector.detectTelegramActionRisk(tc.text, intent, {});
    const domainMatch = intent.domain === tc.expectedDomain;
    const riskMatch = risk.isDangerous === tc.expectedRisk;
    results.push({
      text: tc.text,
      expectedDomain: tc.expectedDomain,
      actualDomain: intent.domain,
      expectedRisk: tc.expectedRisk,
      actualRisk: risk.isDangerous,
      domainMatch,
      riskMatch,
      pass: domainMatch && riskMatch
    });
  }
  const passed = results.filter(r => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed, results, timestamp: new Date().toISOString() };
}

function getTestCases() {
  return [...TEST_CASES];
}

module.exports = {
  getTestCases,
  runRegression,
  TEST_CASES
};
