'use strict';

const { createQualityGate } = require('./cicd-quality-gate');

function createCicdQualityGates() {
  return createQualityGate();
}

module.exports = { createCicdQualityGates, createQualityGate };
