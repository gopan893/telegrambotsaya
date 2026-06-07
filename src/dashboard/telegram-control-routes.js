'use strict';

const express = require('express');
const path = require('path');
const tc = require('../telegram-control');

function registerTelegramControlRoutes(router, services) {
  const auditLog = services.auditLog || tc.commandAudit;

  router.get('/telegram-control', (req, res) => {
    const categories = tc.commandRegistry.getCategories();
    const total = tc.commandRegistry.listTelegramCommands().length;
    const pendingProps = tc.proposalRouter.listPendingProposals();
    return res.json({
      ok: true,
      totalCommands: total,
      categories,
      pendingProposals: pendingProps.length,
      registryValid: tc.commandRegistry.validateTelegramCommandRegistry().valid,
      version: tc.version
    });
  });

  router.get('/telegram-control/commands', (req, res) => {
    const filters = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.module) filters.module = req.query.module;
    if (req.query.riskLevel) filters.riskLevel = req.query.riskLevel;
    if (req.query.enabled !== undefined) filters.enabled = req.query.enabled === 'true';
    if (req.query.search) filters.search = req.query.search;

    const commands = tc.commandRegistry.listTelegramCommands(filters);
    return res.json({ ok: true, total: commands.length, items: commands.map(sanitizeCommandForDashboard) });
  });

  router.get('/telegram-control/commands/:name', (req, res) => {
    const cmd = tc.commandRegistry.getTelegramCommand(req.params.name);
    if (!cmd) return res.status(404).json({ ok: false, error: 'Command not found' });
    return res.json({ ok: true, command: sanitizeCommandForDashboard(cmd) });
  });

  router.get('/telegram-control/categories', (req, res) => {
    return res.json({ ok: true, items: tc.commandRegistry.getCategories() });
  });

  router.post('/telegram-control/test-intent', (req, res) => {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: 'text required' });

    const classification = tc.intentClassifier.classifyTelegramIntent(text, {});
    let command = null;
    if (classification.command) {
      command = tc.commandRegistry.getTelegramCommand(classification.command);
    }
    const risk = command ? tc.riskClassifier.classifyTelegramCommandRisk(command) : tc.riskClassifier.classifyTelegramNaturalRisk(classification);

    const response = tc.naturalRouter.routeTelegramNaturalMessage(
      { message: { text, from: { id: 'dashboard_test' }, chat: { id: 'dashboard_test' } } },
      {}
    );

    return res.json({
      ok: true,
      classification,
      command: command ? sanitizeCommandForDashboard(command) : null,
      risk,
      routeResult: {
        handled: response.handled,
        intent: response.intent,
        blocked: response.blocked || false,
        isFollowup: response.isFollowup || false,
        response: response.response || null
      }
    });
  });

  router.get('/telegram-control/audit', (req, res) => {
    const filters = {};
    if (req.query.limit) filters.limit = parseInt(req.query.limit, 10) || 50;
    if (req.query.command) filters.command = req.query.command;
    if (req.query.module) filters.module = req.query.module;
    const entries = auditLog.listTelegramCommandAudit(filters);
    return res.json({ ok: true, total: entries.length, items: entries });
  });

  router.get('/telegram-control/pending-proposals', (req, res) => {
    const proposals = tc.proposalRouter.listPendingProposals();
    return res.json({ ok: true, total: proposals.length, items: proposals });
  });

  router.get('/telegram-control/help', (req, res) => {
    const category = req.query.category;
    const commandName = req.query.command;

    if (commandName) {
      const help = tc.helpMenu.buildTelegramCommandHelp(commandName);
      return res.json({ ok: true, help, command: commandName });
    }
    if (category) {
      const menu = tc.helpMenu.buildTelegramCategoryMenu(category);
      return res.json({ ok: true, help: menu, category });
    }
    const menu = tc.helpMenu.buildTelegramMainMenu();
    return res.json({ ok: true, help: menu });
  });

  router.post('/telegram-control/validate-registry', (req, res) => {
    const result = tc.commandRegistry.validateTelegramCommandRegistry();
    return res.json({ ok: true, ...result });
  });
}

function sanitizeCommandForDashboard(cmd) {
  if (!cmd) return null;
  return {
    name: cmd.name,
    aliases: cmd.aliases || [],
    module: cmd.module,
    category: cmd.category,
    description: cmd.description,
    examples: cmd.examples || [],
    riskLevel: cmd.riskLevel,
    requiresOwner: cmd.requiresOwner || false,
    requiresAdmin: cmd.requiresAdmin || false,
    requiresApproval: cmd.requiresApproval || false,
    requiresEvaluation: cmd.requiresEvaluation || false,
    enabled: cmd.enabled !== false
  };
}

module.exports = { registerTelegramControlRoutes };
