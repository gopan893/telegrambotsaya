'use strict';

function summarizeFromMemory(user = {}) {
  return {
    warning: 'Profil ini hanya berbasis memory tersimpan, bukan tebakan.',
    tags: Array.isArray(user.tags) ? user.tags.slice(-8) : [],
    hasSummary: Boolean(user.summary),
    preferenceKeys: Object.keys(user.preferences || {}).slice(0, 8)
  };
}

module.exports = {
  summarizeFromMemory
};
