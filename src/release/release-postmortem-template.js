'use strict';

const utils = require('./release-utils');

const ReleasePostmortemTemplate = {
  generatePostmortemTemplate(releaseId, services = {}) {
    return {
      releaseId,
      version: 'v1.0.0',
      template: {
        incidentId: '',
        severity: '',
        summary: '',
        timeline: [
          { time: '', event: '' }
        ],
        rootCause: '',
        impact: {
          users: '',
          uptime: '',
          features: ''
        },
        detection: '',
        resolution: '',
        lessonsLearned: [
          ''
        ],
        actionItems: [
          { item: '', owner: '', priority: '', status: 'open' }
        ],
        createdAt: utils.formatTimestamp()
      },
      note: 'Complete this template if the release encounters critical issues requiring a postmortem.'
    };
  }
};

module.exports = ReleasePostmortemTemplate;
