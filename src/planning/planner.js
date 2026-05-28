'use strict';

const planner = require('../agents/planner');

function isContinuingPreviousTask(userMessage, sessionState) {
  if (!sessionState || !sessionState.activeTask) return false;

  const lower = String(userMessage || '').toLowerCase();
  return [
    'lanjut',
    'next',
    'ok',
    'oke',
    'siap',
    'sudah',
    'done',
    'bagaimana langkah',
    'berikutnya',
    'tahap selanjutnya',
    'lanjutkan'
  ].some((keyword) => lower.includes(keyword));
}

async function generateWorkflowPlan(userMessage, userId, botServices) {
  return planner.generatePlan('compat_planner', userMessage, userId, botServices);
}

async function executeWorkflowNextStep(userId, userMessage, context, botServices) {
  return planner.executeNextStep(
    'compat_planner',
    userId,
    userMessage,
    context?.rawSession || context,
    botServices
  );
}

module.exports = {
  isContinuingPreviousTask,
  generateWorkflowPlan,
  executeWorkflowNextStep
};
