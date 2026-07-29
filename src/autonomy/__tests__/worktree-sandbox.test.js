'use strict';

const { createWorktreeSandbox } = require('../worktree-sandbox');

describe('worktree sandbox', () => {
  test('creates isolated branch with execFileSync argument arrays', () => {
    const execFileSync = jest.fn();
    const sandbox = createWorktreeSandbox({ root: '/repo', execFileSync, mkdirSync: jest.fn() });

    expect(sandbox.create({ branch: 'feature/safe', baseRef: 'origin/main' })).toEqual({
      branch: 'feature/safe',
      dir: '/repo/.worktrees/feature/safe'
    });
    expect(execFileSync).toHaveBeenCalledWith('git', [
      'worktree', 'add', '-b', 'feature/safe', '/repo/.worktrees/feature/safe', 'origin/main'
    ], expect.objectContaining({ cwd: '/repo' }));
  });

  test('uses HEAD when baseRef omitted, runs injected checks, and cleans up', () => {
    const execFileSync = jest.fn();
    const sandbox = createWorktreeSandbox({ root: '/repo', execFileSync, mkdirSync: jest.fn() });
    const created = sandbox.create({ branch: 'feature/test' });

    sandbox.runChecks(created.dir, [['node', '--check', 'telebot.js']]);
    sandbox.cleanup(created.dir);
    sandbox.rollback('feature/test');

    expect(execFileSync.mock.calls).toEqual(expect.arrayContaining([
      ['git', ['worktree', 'add', '-b', 'feature/test', '/repo/.worktrees/feature/test', 'HEAD'], expect.any(Object)],
      ['node', ['--check', 'telebot.js'], expect.objectContaining({ cwd: created.dir })],
      ['git', ['worktree', 'remove', '--force', created.dir], expect.any(Object)],
      ['git', ['branch', '-D', 'feature/test'], expect.any(Object)]
    ]));
  });

  test.each(['../escape', '-danger', '', 'bad name'])('rejects unsafe branch %p', branch => {
    const sandbox = createWorktreeSandbox({ root: '/repo', execFileSync: jest.fn(), mkdirSync: jest.fn() });
    expect(() => sandbox.create({ branch })).toThrow('Invalid branch');
  });

  test('refuses rollback of protected branches', () => {
    const execFileSync = jest.fn();
    const sandbox = createWorktreeSandbox({ execFileSync });
    expect(() => sandbox.rollback('main')).toThrow('Refusing rollback');
    expect(() => sandbox.rollback('master')).toThrow('Refusing rollback');
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
