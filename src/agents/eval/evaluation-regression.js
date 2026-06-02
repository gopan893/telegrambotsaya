'use strict';

function compareRuns(current = {}, previous = {}) {
  if (!current || !previous) {
    return { ok: true, regressions: [], reason: 'not_enough_runs' };
  }
  const regressions = [];
  const currentScores = current.categoryScores || {};
  const previousScores = previous.categoryScores || {};
  for (const [key, previousValue] of Object.entries(previousScores)) {
    const currentValue = Number(currentScores[key] || 0);
    const delta = currentValue - Number(previousValue || 0);
    if (delta <= -10) regressions.push({ key, previousValue, currentValue, delta });
  }
  if (Number(current.averageScore || 0) < Number(previous.averageScore || 0) - 8) {
    regressions.push({
      key: 'averageScore',
      previousValue: previous.averageScore,
      currentValue: current.averageScore,
      delta: Number(current.averageScore || 0) - Number(previous.averageScore || 0)
    });
  }
  return {
    ok: regressions.length === 0,
    regressions
  };
}

module.exports = {
  compareRuns
};
