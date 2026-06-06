'use strict';

const express = require('express');
const knowledge = require('../src/knowledge');
const registerRoutes = require('../src/dashboard/knowledge-routes').registerKnowledgeRoutes;
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-knowledge-dashboard-api');

knowledge.knowledgeGraphStore.reset();
const app = express();
app.use(express.json());
const router = express.Router();
registerRoutes(router);
app.use('/api/dashboard', router);

async function get(path) {
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const http = require('http');
      http.get({ port, path, headers: { 'x-dashboard-actor': 'tester' } }, res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body }); });
      }).on('error', err => { server.close(); resolve({ status: 500, body: String(err) }); });
    });
  });
}

async function post(path, body) {
  return new Promise(resolve => {
    const data = JSON.stringify(body);
    const server = app.listen(0, () => {
      const port = server.address().port;
      const http = require('http');
      const req = http.request({ port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => {
        let buf = '';
        res.on('data', c => { buf += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: buf }); });
      });
      req.on('error', err => { server.close(); resolve({ status: 500, body: String(err) }); });
      req.write(data);
      req.end();
    });
  });
}

(async () => {
  let r = await get('/api/dashboard/knowledge');
  assert(r.status === 200, 'GET / 200');
  let j = JSON.parse(r.body);
  assert(j.ok === true, 'GET / ok');
  assert(j.summary && j.summary.workspaceId, 'overview has workspaceId');

  knowledge.knowledgeGraphStore.createKnowledgeNode({ type: 'project', title: 'AI OS', summary: 'main' });
  knowledge.knowledgeGraphStore.createKnowledgeNode({ type: 'phase', title: 'Phase 42', summary: 'kg', source: 'phase_summary', sourceId: '42' });
  knowledge.knowledgeGraphStore.createKnowledgeNode({ type: 'decision', title: 'Use Node 20', summary: 'core', source: 'core_decisions', sourceId: 'core-node-20' });

  r = await get('/api/dashboard/knowledge/nodes?type=decision');
  j = JSON.parse(r.body);
  assert(j.ok && j.nodes.length >= 1, 'GET /nodes?type=decision returns rows');

  r = await get('/api/dashboard/knowledge/search?q=phase');
  j = JSON.parse(r.body);
  assert(j.ok && j.nodes.length >= 1, 'GET /search?q=phase returns rows');

  r = await get('/api/dashboard/knowledge/decisions');
  j = JSON.parse(r.body);
  assert(j.ok && j.decisions.length >= 1, 'GET /decisions returns decisions');

  r = await post('/api/dashboard/knowledge/safety-check', { candidate: { title: 'X', summary: 'plain text' } });
  j = JSON.parse(r.body);
  assert(j.ok && j.report.safeToStore === true, 'safety check safe');

  r = await post('/api/dashboard/knowledge/safety-check', { candidate: { title: 'X', summary: 'token: ghp_abcd1234efgh5678' } });
  j = JSON.parse(r.body);
  assert(j.ok && j.report.safeToStore === false, 'safety check blocks secret');

  r = await post('/api/dashboard/knowledge/ingest', { type: 'memory', title: 'New', summary: 'plain' });
  j = JSON.parse(r.body);
  assert(j.ok, 'ingest plain ok');

  r = await post('/api/dashboard/knowledge/ingest', { type: 'memory', title: 'Bad', summary: 'sk-abcdef1234567890' });
  j = JSON.parse(r.body);
  assert(!j.ok, 'ingest blocks secret');

  r = await post('/api/dashboard/knowledge/context-pack', { query: 'phase 42' });
  j = JSON.parse(r.body);
  assert(j.ok && j.pack && j.pack.selectedNodes.length >= 1, 'context pack returns selectedNodes');

  r = await get('/api/dashboard/knowledge/docs-status');
  j = JSON.parse(r.body);
  assert(j.ok && Array.isArray(j.findings), 'docs status returns findings');

  r = await get('/api/dashboard/knowledge/stale');
  j = JSON.parse(r.body);
  assert(j.ok && j.plan, 'stale returns plan');

  r = await post('/api/dashboard/knowledge/archive', { ids: [] });
  j = JSON.parse(r.body);
  assert(!j.ok, 'archive rejects empty ids');

  r = await get('/api/dashboard/knowledge/report');
  j = JSON.parse(r.body);
  assert(j.ok && j.report && j.report.graph, 'report includes graph');

  console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
