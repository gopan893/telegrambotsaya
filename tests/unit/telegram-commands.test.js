'use strict';

const registry = require('../../src/telegram-control/telegram-command-registry');

describe('Telegram Command Registry', () => {
  describe('registerTelegramCommand', () => {
    test('throws on null', () => {
      expect(() => registry.registerTelegramCommand(null)).toThrow(/must have a name/);
    });

    test('throws on missing name', () => {
      expect(() => registry.registerTelegramCommand({})).toThrow(/must have a name/);
    });

    test('throws on empty name', () => {
      expect(() => registry.registerTelegramCommand({ name: '' })).toThrow(/must have a name/);
    });

    test('adds new command', () => {
      const result = registry.registerTelegramCommand({
        name: 'testcmd1',
        aliases: ['tc1'],
        module: 'test',
        category: 'core',
        description: 'A test command',
        riskLevel: 'low'
      });
      expect(result).toBe(true);
    });

    test('updates existing command', () => {
      registry.registerTelegramCommand({
        name: 'testcmd1',
        description: 'Updated description'
      });
      const cmd = registry.getTelegramCommand('testcmd1');
      expect(cmd.description).toBe('Updated description');
    });
  });

  describe('getTelegramCommand', () => {
    test('returns null for empty name', () => {
      expect(registry.getTelegramCommand(null)).toBeNull();
      expect(registry.getTelegramCommand('')).toBeNull();
    });

    test('returns command by name', () => {
      const cmd = registry.getTelegramCommand('start');
      expect(cmd).toBeTruthy();
      expect(cmd.name).toBe('start');
    });

    test('finds by alias', () => {
      const cmd = registry.getTelegramCommand('mulai');
      expect(cmd).toBeTruthy();
      expect(cmd.name).toBe('start');
    });

    test('strips leading slash', () => {
      const cmd = registry.getTelegramCommand('/help');
      expect(cmd).toBeTruthy();
      expect(cmd.name).toBe('help');
    });

    test('is case insensitive', () => {
      const cmd = registry.getTelegramCommand('HELP');
      expect(cmd).toBeTruthy();
      expect(cmd.name).toBe('help');
    });

    test('returns null for unknown command', () => {
      expect(registry.getTelegramCommand('nonexistent_cmd_xyz')).toBeNull();
    });
  });

  describe('listTelegramCommands', () => {
    test('returns all commands without filters', () => {
      const all = registry.listTelegramCommands();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(10);
    });
  });

  describe('findTelegramCommandByIntent', () => {
    test('finds command by intent', () => {
      const cmd = registry.findTelegramCommandByIntent('help');
      expect(cmd).toBeTruthy();
    });
  });

  describe('getCategories', () => {
    test('returns categories array', () => {
      const cats = registry.getCategories();
      expect(Array.isArray(cats)).toBe(true);
    });
  });
});
