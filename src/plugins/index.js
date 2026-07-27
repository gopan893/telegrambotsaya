'use strict';

module.exports = {
  pluginStore: require('./plugin-store'),
  connectorRegistry: require('./connector-registry'),
  pluginValidator: require('./plugin-validator'),
  pluginSandbox: require('./plugin-sandbox'),
  pluginPermissionEngine: require('./plugin-permission-engine'),
  connectorFactory: require('./connector-factory'),
  pluginInstaller: require('./plugin-installer'),
  pluginLifecycleManager: require('./plugin-lifecycle-manager'),
  pluginDependencyResolver: require('./plugin-dependency-resolver'),
  pluginConfigManager: require('./plugin-config-manager'),
  pluginEventBus: require('./plugin-event-bus'),
  pluginMarketplaceClient: require('./plugin-marketplace-client'),
  pluginManifestParser: require('./plugin-manifest-parser'),
  connectorErrorMapper: require('./connector-error-mapper'),
  connectorHealthChecker: require('./connector-health-checker'),
  connectorRateLimiter: require('./connector-rate-limiter'),
  pluginSigningVerifier: require('./plugin-signing-verifier'),
  pluginUpdateChecker: require('./plugin-update-checker'),
  connectorLogAdapter: require('./connector-log-adapter'),
  pluginUtils: require('./plugin-utils')
};
