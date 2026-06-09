# Plugin/Connector SDK

## Overview

The Plugin SDK enables third-party developers to extend the TelegramBotSaya platform with custom connectors, middleware, and automation capabilities. Plugins are self-contained modules that register with the core runtime via a declarative manifest.

---

## Plugin Lifecycle

| Phase | Method | Description |
|-------|--------|-------------|
| **Install** | `onInstall()` | Called once after manifest validation. Copies plugin assets into the managed plugin directory. |
| **Enable** | `onEnable()` | Called on every startup (and after manual enable). Registers hooks, event listeners, and scheduled jobs. |
| **Disable** | `onDisable()` | Gracefully tears down active connections, unregisters listeners, cancels timers. |
| **Uninstall** | `onUninstall()` | Removes plugin data, revokes tokens, cleans up persistent state. |

Plugins transition between states via the plugin manager CLI or Dashboard. State is persisted in `plugin_registry.json`.

---

## Manifest Format

Every plugin must provide a `plugin.json` manifest at its root:

```json
{
  "id": "com.example.myconnector",
  "name": "My Connector",
  "version": "1.0.0",
  "minCoreVersion": "2.5.0",
  "permissions": ["read:telegram", "write:knowledge"],
  "connectors": ["http-webhook"],
  "dependencies": {
    "com.example.base": "^1.0.0"
  },
  "entry": "main.js",
  "author": "Example Corp",
  "license": "MIT"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Reverse-domain unique identifier |
| `permissions` | string[] | Declared permission scope (validated at install time) |
| `connectors` | string[] | Built-in connector types the plugin depends on |
| `dependencies` | object | Semver-pinned plugin dependencies |
| `entry` | string | Relative path to the plugin entry point |

---

## Permission Engine

Permissions are declared in the manifest and enforced at runtime.

| Level | Scope | Example |
|-------|-------|---------|
| `none` | No access | Default before approval |
| `read` | Read-only access | `read:knowledge` |
| `write` | Read + write | `write:telegram` |
| `admin` | Unrestricted | `admin:system` |

Permissions are grouped by resource type: `telegram`, `knowledge`, `storage`, `network`, `system`, `connector`.

The permission engine intersects the plugin's declared permissions with the user's grant policy. Any undeclared capability is denied by default.

---

## Sandboxing

Plugins run in a restricted JavaScript sandbox with the following limitations:

- No direct filesystem access (use the managed storage API)
- Network requests limited to declared connector origins
- No `require()` of arbitrary Node modules (whitelist only)
- CPU execution time capped per tick (configurable, default 500ms)
- Memory heap limited (configurable, default 64 MB)
- `eval()`/`new Function()` disabled
- Child process creation blocked

The sandbox exposes a limited global API: `$plugin`, `$logger`, `$storage`, `$http`, `$events`.

---

## Plugin Event Bus

Plugins communicate via a typed event bus. Events are namespaced by plugin ID to prevent collisions.

**Core events:**
- `plugin.installed`, `plugin.enabled`, `plugin.disabled`, `plugin.uninstalled`
- `connector.message`, `connector.error`
- `recipe.triggered`, `recipe.completed`, `recipe.failed`

Plugins can emit custom events via `$events.emit('com.example.myevent', payload)` and subscribe via `$events.on()`.

---

## Dependency Resolution

On install, the plugin manager resolves the dependency graph using semver constraints. Resolution strategy:

1. Load all installed plugin manifests
2. Build a directed graph of dependencies
3. Detect cycles (fail if cycles found)
4. Resolve versions via semver intersection
5. If a dependency is missing, prompt the user or auto-install from marketplace

---

## Marketplace

The plugin marketplace aggregates community and official plugins. Key features:

- **Registry**: JSON index hosted at the configured marketplace URL
- **Versioning**: Semantic versioning with support for `latest`, `beta`, `rc` channels
- **Signing**: Packages are signed via Ed25519; signature verified before install
- **Reviews**: User-submitted ratings and compatibility reports
- **Enterprise gate**: Optional approval workflow for new plugins

---

## Configuration Management

Each plugin receives a namespaced config object merged from:

1. Defaults defined in `plugin.json`
2. User overrides in `config/plugins/<plugin-id>.json`
3. Environment variables prefixed with `PLUGIN_<ID>_`

Config changes are hot-reloaded for plugins that implement `onConfigChange(newConfig)`. Sensitive fields (marked `"secret": true` in the schema) are redacted from logs and the Dashboard.

---

## Security & Privacy

- Secrets are encrypted at rest using the platform master key
- Network egress limited to origins declared in `plugin.json`
- All plugin data is namespaced under `storage/plugins/<plugin-id>/`
- The permission approval gate requires explicit user consent for `admin`-level grants
- Audit log records every lifecycle transition and permission grant
