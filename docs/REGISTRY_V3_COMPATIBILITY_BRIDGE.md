# Registry v3 Compatibility Bridge

Bridges registry v2 and registry v3 for backward compatibility.

### Functions
- `mapRegistryV2ToRegistryV3(services)` - Map v2 items to v3 format
- `mapRegistryV3ToLegacyDashboardCompat(services)` - Map v3 items to legacy dashboard
- `resolveRegistryV3Item(idOrAlias, type, services)` - Resolve item by ID or alias
- `resolveDashboardTabCompat(tabOrAlias, services)` - Resolve dashboard tab compat
- `resolveApiRouteCompat(routeOrAlias, services)` - Resolve API route compat  
- `resolveCommandCompat(commandOrAlias, services)` - Resolve command compat
- `buildRegistryV3CompatibilityReport(services)` - Full compatibility report

### Rules
- v2 callers must keep working
- Old dashboard tabs must keep opening
- Old command aliases must keep working or show safe deprecation
- No forced replacement of v2
- No breaking changes