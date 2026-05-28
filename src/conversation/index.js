'use strict';

const conversationManager = require('./conversation-manager');

module.exports = conversationManager;
module.exports.conversationManager = conversationManager;
module.exports.createConversationManager = conversationManager.createConversationManager;
