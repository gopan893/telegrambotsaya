'use strict';

const assert = require('assert');

// Since there is no Express router for telegram-control dashboard API,
// we test the underlying logic functions that would be used by such an API.

const registry = require('../src/telegram-control/telegram-command-registry');
const naturalRouter = require('../src/telegram-control/telegram-natural-router');
const intentClassifier = require('../src/telegram-control/telegram-intent-classifier');
const permissionGuard = require('../src/telegram-control/telegram-permission-guard');
const riskClassifier = require('../src/telegram-control/telegram-risk-classifier');
const formatter = require('../src/telegram-control/telegram-response-formatter');
const helpMenu = require('../src/telegram-control/telegram-help-menu');
const proposalRouter = require('../src/telegram-control/telegram-proposal-router');
const audit = require('../src/telegram-control/telegram-command-audit');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

// ── Mock Express-like response helpers ──

function mockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status: function (code) {
      res.statusCode = code;
      return res;
    },
    json: function (data) {
      res.body = data;
      return res;
    },
    send: function (data) {
      res.body = data;
      return res;
    },
    setHeader: function (name, value) {
      res.headers[name] = value;
    }
  };
  return res;
}

function mockRequest(overrides) {
  return {
    query: {},
    params: {},
    body: {},
    ...overrides
  };
}

// Simulate dashboard API handler patterns

function handleCommandsList(req, res) {
  const category = req.query.category;
  const module = req.query.module;
  const riskLevel = req.query.riskLevel;
  const search = req.query.search;
  const enabled = req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined;

  const filters = {};
  if (category) filters.category = category;
  if (module) filters.module = module;
  if (riskLevel) filters.riskLevel = riskLevel;
  if (search) filters.search = search;
  if (enabled !== undefined) filters.enabled = enabled;

  const commands = registry.listTelegramCommands(filters);
  return res.json({ success: true, count: commands.length, commands: commands.slice(0, 50) });
}

function handleCommandDetail(req, res) {
  const name = req.params.name;
  if (!name) return res.status(400).json({ success: false, error: 'Command name required' });
  const cmd = registry.getTelegramCommand(name);
  if (!cmd) return res.status(404).json({ success: false, error: 'Command not found' });
  return res.json({ success: true, command: cmd });
}

function handleCategories(req, res) {
  const cats = registry.getCategories();
  return res.json({ success: true, categories: cats });
}

function handleRegistryValidate(req, res) {
  const result = registry.validateTelegramCommandRegistry();
  return res.json({ success: true, ...result });
}

function handleAuditList(req, res) {
  const filters = {};
  if (req.query.command) filters.command = req.query.command;
  if (req.query.module) filters.module = req.query.module;
  if (req.query.userId) filters.userId = req.query.userId;
  if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);
  const entries = audit.listTelegramCommandAudit(filters);
  return res.json({ success: true, count: entries.length, entries });
}

function handleAuditSize(req, res) {
  return res.json({ success: true, size: audit.getAuditLogSize() });
}

function handleProposalList(req, res) {
  const proposals = proposalRouter.listPendingProposals();
  return res.json({ success: true, count: proposals.length, proposals });
}

function handleRiskClassify(req, res) {
  const { command, riskLevel } = req.body;
  if (!command) return res.status(400).json({ success: false, error: 'Command required' });
  const cmd = registry.getTelegramCommand(command);
  if (!cmd) return res.status(404).json({ success: false, error: 'Command not found' });
  if (riskLevel) cmd.riskLevel = riskLevel;
  const risk = riskClassifier.classifyTelegramCommandRisk(cmd);
  return res.json({ success: true, risk });
}

function run() {
  console.log('=== test-telegram-control-dashboard-api.js ===\n');

  audit.clearAuditLog();

  // ── Test simulated API handlers ──

  test('GET /api/telegram-control/commands - list all', () => {
    const req = mockRequest();
    const res = mockResponse();
    handleCommandsList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.count >= 150);
    assert.ok(Array.isArray(res.body.commands));
  });

  test('GET /api/telegram-control/commands?category=core', () => {
    const req = mockRequest({ query: { category: 'core' } });
    const res = mockResponse();
    handleCommandsList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.count > 0);
    res.body.commands.forEach(c => assert.strictEqual(c.category, 'core'));
  });

  test('GET /api/telegram-control/commands?search=deploy', () => {
    const req = mockRequest({ query: { search: 'deploy' } });
    const res = mockResponse();
    handleCommandsList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.count > 0);
  });

  test('GET /api/telegram-control/commands?riskLevel=high', () => {
    const req = mockRequest({ query: { riskLevel: 'high' } });
    const res = mockResponse();
    handleCommandsList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.count > 0);
    res.body.commands.forEach(c => assert.strictEqual(c.riskLevel, 'high'));
  });

  test('GET /api/telegram-control/commands?module=deploy', () => {
    const req = mockRequest({ query: { module: 'deploy' } });
    const res = mockResponse();
    handleCommandsList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.count > 0);
    res.body.commands.forEach(c => assert.strictEqual(c.module, 'deploy'));
  });

  test('GET /api/telegram-control/commands/:name - valid command', () => {
    const req = mockRequest({ params: { name: 'start' } });
    const res = mockResponse();
    handleCommandDetail(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.strictEqual(res.body.command.name, 'start');
  });

  test('GET /api/telegram-control/commands/:name - via alias', () => {
    const req = mockRequest({ params: { name: 'mulai' } });
    const res = mockResponse();
    handleCommandDetail(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.command.name, 'start');
  });

  test('GET /api/telegram-control/commands/:name - not found', () => {
    const req = mockRequest({ params: { name: 'nonexistent_cmd' } });
    const res = mockResponse();
    handleCommandDetail(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.ok(res.body.error);
  });

  test('GET /api/telegram-control/commands/:name - missing name', () => {
    const req = mockRequest({ params: {} });
    const res = mockResponse();
    handleCommandDetail(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error);
  });

  test('GET /api/telegram-control/categories', () => {
    const req = mockRequest();
    const res = mockResponse();
    handleCategories(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.categories));
    assert.ok(res.body.categories.length > 5);
    res.body.categories.forEach(c => {
      assert.ok(c.key);
      assert.ok(c.label);
      assert.ok(typeof c.count === 'number');
    });
  });

  test('GET /api/telegram-control/validate', () => {
    const req = mockRequest();
    const res = mockResponse();
    handleRegistryValidate(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(typeof res.body.valid === 'boolean');
    assert.ok(res.body.totalCommands >= 150);
  });

  test('GET /api/telegram-control/audit', () => {
    audit.recordTelegramCommandAudit({ command: 'dashboard_test', userId: '1', chatId: '2' });
    const req = mockRequest();
    const res = mockResponse();
    handleAuditList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.entries));
  });

  test('GET /api/telegram-control/audit?command=dashboard_test', () => {
    const req = mockRequest({ query: { command: 'dashboard_test' } });
    const res = mockResponse();
    handleAuditList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.count > 0);
    res.body.entries.forEach(e => assert.strictEqual(e.command, 'dashboard_test'));
  });

  test('GET /api/telegram-control/audit/size', () => {
    const req = mockRequest();
    const res = mockResponse();
    handleAuditSize(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(typeof res.body.size === 'number');
  });

  test('GET /api/telegram-control/proposals', () => {
    const req = mockRequest();
    const res = mockResponse();
    handleProposalList(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.proposals));
  });

  test('POST /api/telegram-control/risk-classify', () => {
    const req = mockRequest({ body: { command: 'runexec' } });
    const res = mockResponse();
    handleRiskClassify(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.strictEqual(res.body.risk.level, 'danger');
    assert.strictEqual(res.body.risk.requiresApproval, true);
  });

  test('POST /api/telegram-control/risk-classify with custom riskLevel', () => {
    const req = mockRequest({ body: { command: 'help', riskLevel: 'high' } });
    const res = mockResponse();
    handleRiskClassify(req, res);
    assert.strictEqual(res.body.risk.level, 'high');
  });

  test('POST /api/telegram-control/risk-classify missing command', () => {
    const req = mockRequest({ body: {} });
    const res = mockResponse();
    handleRiskClassify(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  test('POST /api/telegram-control/risk-classify unknown command', () => {
    const req = mockRequest({ body: { command: 'not_a_real_cmd' } });
    const res = mockResponse();
    handleRiskClassify(req, res);
    assert.strictEqual(res.statusCode, 404);
  });

  // ── Test sanitization patterns used by API ──

  test('API response data sanitizes secrets in command descriptions', () => {
    const cmd = registry.getTelegramCommand('start');
    assert.ok(cmd);
    const json = JSON.stringify(cmd);
    // Should not contain raw tokens
    assert.ok(!json.includes('sk-'));
  });

  test('API list response sanitizes via formatter (indirect)', () => {
    const sanitized = formatter.sanitizeTelegramResponse('some ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    assert.ok(sanitized.includes('[REDACTED_GH_TOKEN]'));
  });

  // ── Test natural message routing (used by chat API endpoint) ──

  test('API natural message handler classifies slash command', () => {
    const msg = { message: { text: '/health', from: { id: 1, is_bot: false }, chat: { id: 2 }, message_id: 1 } };
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.command.name, 'health');
  });

  test('API natural message handler rejects secrets', () => {
    const msg = { message: { text: 'TELEGRAM_TOKEN=abc123', from: { id: 1, is_bot: false }, chat: { id: 2 }, message_id: 1 } };
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
  });

  test('API categories endpoint returns all categories', () => {
    const cats = registry.getCategories();
    assert.ok(cats.length > 0);
    cats.forEach(c => {
      assert.ok(typeof c.key === 'string');
      assert.ok(typeof c.label === 'string');
      assert.ok(typeof c.count === 'number');
    });
  });

  test('API can validate all commands have valid risk levels', () => {
    const result = registry.validateTelegramCommandRegistry();
    // Ignore the duplicate we registered earlier if any
    const riskIssues = result.issues.filter(i => i.type === 'invalid_risk');
    assert.strictEqual(riskIssues.length, 0, JSON.stringify(riskIssues));
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
