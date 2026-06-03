'use strict';

const conversationManager = require('./conversation-manager');

module.exports = conversationManager;
module.exports.conversationManager = conversationManager;
module.exports.createConversationManager = conversationManager.createConversationManager;
module.exports.dialogueState = require('./dialogue-state');
module.exports.pendingActionsModule = require('./pending-actions');
module.exports.followupDetector = require('./followup-detector');
module.exports.continuationHandler = require('./continuation-handler');
module.exports.topicShiftDetector = require('./topic-shift-detector');
module.exports.contextWindowModule = require('./context-window');
module.exports.clarificationHandler = require('./clarification-handler');
module.exports.guards = require('./conversation-guards');
