'use strict';

const uxConfig = new Map();

const DEFAULTS = {
  maxMessageLength: 3500,
  preferredFormat: 'markdown',
  fallbackToPlain: true,
  enableKeyboard: true,
  enablePartHeaders: true,
  enableProgress: true,
  verbosity: 'normal',
  language: 'id'
};

function getUxConfig(chatId) {
  const key = String(chatId || 'default');
  if (!uxConfig.has(key)) {
    uxConfig.set(key, { ...DEFAULTS });
  }
  return uxConfig.get(key);
}

function updateUxConfig(chatId, patch) {
  const config = getUxConfig(chatId);
  Object.assign(config, patch);
  uxConfig.set(String(chatId || 'default'), config);
  return config;
}

function resetUxConfig(chatId) {
  uxConfig.set(String(chatId || 'default'), { ...DEFAULTS });
}

function setVerbosity(chatId, level) {
  const valid = ['minimal', 'normal', 'detailed'];
  if (!valid.includes(level)) return false;
  return updateUxConfig(chatId, { verbosity: level });
}

function setLanguage(chatId, lang) {
  return updateUxConfig(chatId, { language: lang });
}

function getVerbosity(chatId) {
  return getUxConfig(chatId).verbosity;
}

function getLanguage(chatId) {
  return getUxConfig(chatId).language;
}

module.exports = {
  DEFAULTS,
  getLanguage,
  getUxConfig,
  getVerbosity,
  resetUxConfig,
  setLanguage,
  setVerbosity,
  updateUxConfig
};
