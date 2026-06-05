'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

function _getHandoffPath(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const candidates = [
    path.join(repoRoot, 'AGENT_HANDOFF.md'),
    path.join(repoRoot, 'docs', 'AGENT_HANDOFF.md')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function _defaultHandoff() {
  return {
    id: utils.shortId(),
    lastAgent: 'unknown',
    currentTask: 'No active task',
    goal: '',
    filesChanged: [],
    completed: [],
    unfinished: [],
    integrationNotes: '',
    testsRun: [],
    testsFailed: [],
    testsSkipped: [],
    remainingRisks: [],
    nextAgentTask: '',
    createdAt: utils.now(),
    updatedAt: utils.now()
  };
}

function _handoffToMd(handoff) {
  const lines = [
    '# AGENT_HANDOFF.md',
    '',
    '## Last Agent',
    handoff.lastAgent || 'unknown',
    '',
    '## Current Task',
    handoff.currentTask || '',
    '',
    '## Goal',
    handoff.goal || '',
    '',
    '## Files Changed',
    ...(Array.isArray(handoff.filesChanged) && handoff.filesChanged.length
      ? handoff.filesChanged.map(f => `- ${f}`)
      : ['- None']),
    '',
    '## What Was Completed',
    ...(Array.isArray(handoff.completed) && handoff.completed.length
      ? handoff.completed.map(f => `- ${f}`)
      : ['- None']),
    '',
    '## What Is Not Finished',
    ...(Array.isArray(handoff.unfinished) && handoff.unfinished.length
      ? handoff.unfinished.map(f => `- ${f}`)
      : ['- None']),
    '',
    '## Integration Notes',
    handoff.integrationNotes || '- None',
    '',
    '## Tests Run',
    ...(Array.isArray(handoff.testsRun) && handoff.testsRun.length
      ? handoff.testsRun.map(f => `- ${f}`)
      : ['- None']),
    '',
    '## Tests Skipped',
    ...(Array.isArray(handoff.testsSkipped) && handoff.testsSkipped.length
      ? handoff.testsSkipped.map(f => `- ${f}`)
      : ['- None']),
    '',
    '## Tests Failed',
    ...(Array.isArray(handoff.testsFailed) && handoff.testsFailed.length
      ? handoff.testsFailed.map(f => `- ${f}`)
      : ['- None']),
    '',
    '## Remaining Risks',
    ...(Array.isArray(handoff.remainingRisks) && handoff.remainingRisks.length
      ? handoff.remainingRisks.map(r => `- ${r}`)
      : ['- None']),
    '',
    '## Next Agent Task',
    handoff.nextAgentTask || '- None',
    ''
  ];
  return lines.join('\n');
}

function _mdToHandoff(content) {
  const handoff = _defaultHandoff();
  const lines = content.split('\n');
  let currentSection = '';
  for (const line of lines) {
    const headerMatch = line.match(/^## (.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1].toLowerCase().replace(/\s+/g, '');
      continue;
    }
    const value = line.replace(/^- /, '').trim();
    if (!value) continue;
    switch (currentSection) {
      case 'lastagent': handoff.lastAgent = value; break;
      case 'currenttask': handoff.currentTask = value; break;
      case 'goal': handoff.goal = value; break;
      case 'fileschanged': if (line.startsWith('- ')) handoff.filesChanged.push(value); break;
      case 'whatwascompleted': if (line.startsWith('- ')) handoff.completed.push(value); break;
      case 'whatisnotfinished': if (line.startsWith('- ')) handoff.unfinished.push(value); break;
      case 'integrationnotes': handoff.integrationNotes = value; break;
      case 'testsrun': if (line.startsWith('- ')) handoff.testsRun.push(value); break;
      case 'testsskipped': if (line.startsWith('- ')) handoff.testsSkipped.push(value); break;
      case 'testsfailed': if (line.startsWith('- ')) handoff.testsFailed.push(value); break;
      case 'remainingrisks': if (line.startsWith('- ')) handoff.remainingRisks.push(value); break;
      case 'nextagenttask': handoff.nextAgentTask = value; break;
    }
  }
  return handoff;
}

function readHandoff(services) {
  const hp = _getHandoffPath(services);
  if (!fs.existsSync(hp)) {
    const def = _defaultHandoff();
    const md = _handoffToMd(def);
    fs.writeFileSync(hp, md, 'utf8');
    store.setHandoff(def, services);
    return { ok: true, handoff: def, created: true, path: hp };
  }
  const content = fs.readFileSync(hp, 'utf8');
  const handoff = _mdToHandoff(content);
  handoff.path = hp;
  store.setHandoff(handoff, services);
  return { ok: true, handoff, path: hp };
}

function writeHandoff(handoff, services) {
  const hp = _getHandoffPath(services);
  handoff.updatedAt = utils.now();
  const md = _handoffToMd(handoff);
  fs.writeFileSync(hp, md, 'utf8');
  store.setHandoff(handoff, services);
  return { ok: true, path: hp, handoff };
}

function createRecoveryHandoffFromGitDiff(context, services) {
  const repoRoot = services?.repoRoot || process.cwd();
  let diff = '';
  let changedFiles = [];
  try {
    const { execSync } = require('child_process');
    diff = execSync('git diff --stat', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4096 }).toString();
    const diffFull = execSync('git diff', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16384 }).toString();
    changedFiles = diff.split('\n').filter(l => l.includes('|')).map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
    if (!diff.trim()) {
      const status = execSync('git status --short', { cwd: repoRoot, encoding: 'utf8' }).toString();
      changedFiles = status.split('\n').filter(l => l.trim()).map(l => l.trim().split(/\s+/)[1]).filter(Boolean);
      diff = status;
    }
    diff = utils.safeGitDiffExcerpt(diffFull || diff);
  } catch (_) {
    diff = '[Could not read git diff]';
  }

  const handoff = {
    id: utils.shortId(),
    lastAgent: context?.lastAgent || 'unknown',
    currentTask: context?.currentTask || 'Recovery handoff — previous agent did not complete handoff',
    goal: context?.goal || 'Audit and recover from interrupted session',
    filesChanged: changedFiles.length ? changedFiles : ['Unknown — check git status'],
    completed: [],
    unfinished: ['Full audit needed — previous agent did not report completion'],
    integrationNotes: 'Recovery handoff generated from git diff. Manual audit required before continuing.',
    testsRun: [],
    testsFailed: [],
    testsSkipped: [],
    remainingRisks: [
      'Unfinished agent work detected',
      'No test results from previous agent',
      'Integration contract may be broken',
      'Dashboard routes may be inconsistent'
    ],
    nextAgentTask: '1. Audit git diff\n2. Run node --check telebot.js\n3. Run related tests\n4. Validate integration contract\n5. Update handoff\n6. Continue task safely',
    createdAt: utils.now(),
    updatedAt: utils.now()
  };

  return writeHandoff(handoff, services);
}

function updateHandoffAfterTask(result, services) {
  const existing = readHandoff(services);
  if (!existing.ok) return existing;
  const handoff = existing.handoff;
  if (result.completed) handoff.completed.push(...result.completed);
  if (result.unfinished) handoff.unfinished.push(...result.unfinished);
  if (result.testsRun) handoff.testsRun.push(...result.testsRun);
  if (result.testsFailed) handoff.testsFailed.push(...result.testsFailed);
  if (result.testsSkipped) handoff.testsSkipped.push(...result.testsSkipped);
  if (result.remainingRisks) handoff.remainingRisks.push(...result.remainingRisks);
  if (result.nextAgentTask) handoff.nextAgentTask = result.nextAgentTask;
  handoff.currentTask = result.currentTask || handoff.currentTask;
  handoff.goal = result.goal || handoff.goal;
  return writeHandoff(handoff, services);
}

function generateHandoffSummary(services) {
  const result = readHandoff(services);
  if (!result.ok) return result;
  const h = result.handoff;
  return {
    ok: true,
    summary: {
      id: h.id,
      lastAgent: h.lastAgent,
      currentTask: h.currentTask,
      goal: h.goal,
      filesChanged: h.filesChanged.length,
      completed: h.completed.length,
      unfinished: h.unfinished.length,
      testsRun: h.testsRun.length,
      testsFailed: h.testsFailed.length,
      testsSkipped: h.testsSkipped.length,
      remainingRisks: h.remainingRisks.length,
      hasNextTask: Boolean(h.nextAgentTask),
      createdAt: h.createdAt,
      updatedAt: h.updatedAt
    },
    handoff: h
  };
}

module.exports = {
  readHandoff,
  writeHandoff,
  createRecoveryHandoffFromGitDiff,
  updateHandoffAfterTask,
  generateHandoffSummary
};
