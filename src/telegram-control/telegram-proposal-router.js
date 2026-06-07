'use strict';

const utils = require('./telegram-utils');

const pendingProposals = new Map();
const messageProposalLinks = new Map();

function routeTelegramActionToProposal(actionPlan) {
  if (!actionPlan || !actionPlan.command) {
    return { error: 'No action plan provided' };
  }

  const existing = findDuplicateProposal(actionPlan);
  if (existing) {
    return { duplicate: true, proposal: existing, message: 'A similar proposal is already pending. Use /approve to approve it or /reject to reject it.' };
  }

  return createTelegramExecutorProposal(actionPlan);
}

function createTelegramExecutorProposal(actionPlan) {
  const proposalId = utils.generateId('prop');
  const timestamp = utils.getCurrentTimestamp();

  const proposal = {
    id: proposalId,
    type: 'telegram_control',
    command: actionPlan.command,
    action: actionPlan.action || null,
    intent: actionPlan.intent || null,
    riskLevel: actionPlan.riskLevel || 'unknown',
    args: actionPlan.args || {},
    source: 'telegram',
    chatId: actionPlan.chatId || null,
    userId: actionPlan.userId || null,
    status: 'pending',
    approved: false,
    executed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    approvedAt: null,
    executedAt: null,
    evaluationPassed: null,
    result: null
  };

  pendingProposals.set(proposalId, proposal);

  return { created: true, proposal };
}

function linkTelegramMessageToProposal(messageId, proposalId) {
  if (!messageId || !proposalId) return false;
  messageProposalLinks.set(String(messageId), proposalId);
  return true;
}

function formatProposalForTelegram(proposal) {
  if (!proposal) return 'No proposal data.';

  const riskEmoji = { read_only: '📖', low: '🟢', medium: '🟡', high: '🟠', danger: '🔴' };

  let text = `📋 *Proposal: ${proposal.id}*\n`;
  text += `Command: \`/${proposal.command}\`\n`;
  text += `Action: ${proposal.action || proposal.command}\n`;
  text += `Risk Level: ${riskEmoji[proposal.riskLevel] || '⚪'} ${proposal.riskLevel}\n`;
  text += `Status: ${proposal.status}\n`;

  if (proposal.args && Object.keys(proposal.args).length > 0) {
    const safeArgs = { ...proposal.args };
    text += `\nArguments:\n${JSON.stringify(safeArgs, null, 2)}\n`;
  }

  text += `\n_Use /approve ${proposal.id} to approve._\n`;
  text += `_Use /reject ${proposal.id} to reject._\n`;
  text += `_After approval, use /runexec ${proposal.id} to execute._`;

  return text;
}

function getPendingProposalForTelegramContext(context) {
  if (!context) return null;
  const chatId = context.chatId || context.chat?.id;
  const userId = context.userId || context.from?.id;

  for (const prop of pendingProposals.values()) {
    if (prop.status === 'pending') {
      if (chatId && prop.chatId === chatId) return prop;
      if (userId && prop.userId === userId) return prop;
    }
  }
  return null;
}

function findDuplicateProposal(actionPlan) {
  const cmd = actionPlan.command;
  const action = actionPlan.action;
  const chatId = actionPlan.chatId;

  for (const prop of pendingProposals.values()) {
    if (prop.status !== 'pending') continue;
    if (prop.command === cmd && prop.action === action && prop.chatId === chatId) {
      return prop;
    }
  }
  return null;
}

function getProposalById(proposalId) {
  return pendingProposals.get(proposalId) || null;
}

function updateProposalStatus(proposalId, updates) {
  const prop = pendingProposals.get(proposalId);
  if (!prop) return null;
  Object.assign(prop, updates, { updatedAt: utils.getCurrentTimestamp() });
  pendingProposals.set(proposalId, prop);
  return prop;
}

function getProposalByMessageId(messageId) {
  const proposalId = messageProposalLinks.get(String(messageId));
  if (!proposalId) return null;
  return pendingProposals.get(proposalId) || null;
}

function listPendingProposals() {
  return Array.from(pendingProposals.values()).filter(p => p.status === 'pending');
}

function listAllProposals() {
  return Array.from(pendingProposals.values());
}

module.exports = {
  routeTelegramActionToProposal,
  createTelegramExecutorProposal,
  linkTelegramMessageToProposal,
  formatProposalForTelegram,
  getPendingProposalForTelegramContext,
  findDuplicateProposal,
  getProposalById,
  updateProposalStatus,
  getProposalByMessageId,
  listPendingProposals,
  listAllProposals
};
