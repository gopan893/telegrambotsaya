'use strict';

module.exports = {
  connectorExecutor: require('./connector-executor'),
  connectorPermissions: require('./connector-permissions'),
  connectorQualityGates: require('./connector-quality-gates'),
  connectorRateLimit: require('./connector-rate-limit'),
  connectorResultSanitizer: require('./connector-result-sanitizer'),
  connectorStore: require('./connector-execution-store'),
  evaluationGate: require('./integration-evaluation-gate'),
  integrationEvaluationGate: require('./integration-evaluation-gate'),
  proposalPipeline: require('./integration-proposal-pipeline'),
  connectors: {
    github: require('./connectors/github-connector'),
    googleCalendar: require('./connectors/google-calendar-connector'),
    gmailDraft: require('./connectors/gmail-draft-connector'),
    cloudflareNas: require('./connectors/cloudflare-nas-connector'),
    webhook: require('./connectors/webhook-connector')
  }
};
