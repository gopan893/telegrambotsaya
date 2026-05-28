'use strict';

function selectMemoryHints(user = {}, aiOSStatus = {}, mode = 'auto') {
  const hints = [];
  if (user.summary) hints.push(`Ringkasan user tersedia: ${String(user.summary).slice(0, 180)}`);
  if (aiOSStatus.activeGoals > 0) hints.push(`Ada ${aiOSStatus.activeGoals} goal aktif.`);
  if (aiOSStatus.activeWorkflows > 0) hints.push(`Ada ${aiOSStatus.activeWorkflows} workflow aktif.`);
  if (mode.includes('learning') || mode.includes('mentor')) hints.push('Prioritaskan penjelasan bertahap dan latihan.');
  if (mode.includes('strategic') || mode.includes('decision')) hints.push('Prioritaskan risiko, trade-off, opsi, dan next action.');
  return hints.slice(0, 5);
}

module.exports = {
  selectMemoryHints
};
