'use strict';

const path = require('path');
const { mkdirSync: systemMkdirSync } = require('fs');
const { execFileSync: systemExecFileSync } = require('child_process');

const BRANCH = /^[A-Za-z0-9._/-]+$/;

function validBranch(branch) {
  return typeof branch === 'string' && BRANCH.test(branch) && !branch.startsWith('-') &&
    !branch.split('/').includes('..');
}

function createWorktreeSandbox({ root = process.cwd(), execFileSync = systemExecFileSync, mkdirSync = systemMkdirSync, checks = [] } = {}) {
  const workspaceRoot = path.resolve(root, '.worktrees');
  const worktrees = new Map();

  function assertBranch(branch) {
    if (!validBranch(branch)) throw new Error('Invalid branch');
  }

  function create({ branch, baseRef = 'HEAD' } = {}) {
    assertBranch(branch);
    assertBranch(baseRef);
    const dir = path.resolve(workspaceRoot, branch);
    if (dir !== workspaceRoot && !dir.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error('Invalid branch');
    mkdirSync(workspaceRoot, { recursive: true });
    execFileSync('git', ['worktree', 'add', '-b', branch, dir, baseRef], { cwd: root, stdio: 'pipe' });
    worktrees.set(branch, dir);
    return { branch, dir };
  }

  function assertWorktree(dir) {
    if (![...worktrees.values()].includes(dir)) throw new Error('Unknown worktree');
  }

  function runChecks(dir, commands = checks) {
    assertWorktree(dir);
    if (!Array.isArray(commands)) throw new TypeError('Checks must be command arrays');
    return commands.map(command => {
      if (!Array.isArray(command) || !command.length || typeof command[0] !== 'string') {
        throw new TypeError('Checks must be command arrays');
      }
      return execFileSync(command[0], command.slice(1), { cwd: dir, stdio: 'pipe' });
    });
  }

  function cleanup(dir) {
    assertWorktree(dir);
    execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' });
    for (const [branch, knownDir] of worktrees) if (knownDir === dir) worktrees.delete(branch);
  }

  function rollback(branch) {
    if (branch === 'main' || branch === 'master') throw new Error('Refusing rollback of protected branch');
    assertBranch(branch);
    if (worktrees.has(branch)) throw new Error('Cleanup worktree before rollback');
    execFileSync('git', ['branch', '-D', branch], { cwd: root, stdio: 'pipe' });
  }

  return { create, runChecks, cleanup, rollback };
}

module.exports = { createWorktreeSandbox };
