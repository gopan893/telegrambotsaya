'use strict';

function analyzeGoal(text = '') {
  return {
    goal: String(text || '').trim(),
    successMetric: 'Definisikan hasil yang bisa diamati.',
    blockers: ['Constraint belum jelas', 'Prioritas mungkin terlalu banyak'],
    nextAction: 'Tulis target konkret dan deadline realistis.'
  };
}

module.exports = {
  analyzeGoal
};
