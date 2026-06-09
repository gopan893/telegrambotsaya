# Plugin SDK Security Guide

## Overview

This document details the security model governing plugin execution, connector authentication, and data protection in the Plugin SDK.

---

## Sandbox Restrictions

The plugin sandbox enforces the following restrictions at runtime:

| Resource | Restriction | Enforcement |
|----------|-------------|-------------|
| **Filesystem** | No direct access. Use `$storage` API (namespaced to `storage/plugins/<plugin-id>/`) | `fs` module replaced with proxy; `require('fs')` returns restricted wrapper |
| **Network** | Only origins declared in `plugin.json` `connectors` and `allowedHosts` | HTTP agent proxy with origin whitelist |
| **Modules** | Whitelist only: `crypto` (subset), `path` (safe), `Buffer`, `util`, `stream` | Custom `require()` hook; all other modules return `PermissionDenied` |
| **CPU** | Max 500ms execution per tick | `vm.Script` with `timeout`; watchdog interval |
| **Memory** | Max 64 MB heap | `--max-old-space-size` in child process sandbox; heap snapshot monitoring |
| **Dynamic code** | `eval()`, `new Function()`, `setTimeout`/`setInterval` with string code blocked | AST-level detection at load time |
| **Child processes** | Completely blocked | `child_process` module replaced with no-op |
| **Native addons** | Not allowed | `.node` file detection on require |

---

## Permission Levels

| Level | Symbol | Description |
|-------|--------|-------------|
| **None** | `none` | No access to the resource. Default for undeclared permissions. |
| **Read** | `read` | View/list/query access. No mutation. |
| **Write** | `write` | Read + create/update/delete on non-sensitive resources. |
| **Admin** | `admin` | Unrestricted access including system configuration, user data, and secrets. |

### Resource Scopes

| Scope | Read Allows | Write Allows | Admin Allows |
|-------|-------------|--------------|--------------|
| `telegram` | Read message history | Send messages, manage bots | Full bot admin |
| `knowledge` | Query documents | Add/edit/delete documents | Purge index, manage sources |
| `storage` | List plugin files | Read/write plugin data | Access other plugin data |
| `network` | See allowed hosts | Make outbound requests | Override origin whitelist |
| `connector` | List connector status | Configure connectors | Create/delete connectors |
| `system` | Read system info | Modify non-critical config | Full system control |

---

## Manifest Validation

Every `plugin.json` manifest is validated on install:

1. **Schema validation**: JSON Schema draft-07 — all required fields present, types correct
2. **ID format**: Reverse-domain notation (`com.example.myplugin`), 3–100 chars, alphanumeric + dots
3. **Version format**: Strict semver (`X.Y.Z` with optional pre-release tag)
4. **Permission declaration**: Every permission used in code must be declared; undeclared usage is blocked
5. **AllowedHosts**: Must match the plugin's actual HTTP requests (verified in sandbox)
6. **Entry point**: Must exist and be a `.js` file; directory traversal blocked (`../` rejected)

---

## Signing & Checksum Verification

| Mechanism | Description |
|-----------|-------------|
| **Package signature** | Ed25519 signature over the plugin tarball. Public key pinned in the marketplace config. |
| **Checksum** | SHA-256 hash of `plugin.json` + entry point stored in registry index. Verified after download. |
| **Integrity on load** | Each file's hash recomputed at load time and compared to manifest checksums. Tampered files fail to load. |
| **Offline install** | Must be signed; unsigned plugins require explicit `--allow-unsigned` flag and generate a security warning. |

---

## Connector Auth Schema

Connectors store authentication credentials in a centralized secrets vault:

```json
{
  "id": "connector_github_01",
  "type": "github",
  "auth": {
    "method": "pat",
    "encrypted": true,
    "fields": ["token", "webhook_secret"]
  }
}
```

- Credentials are encrypted using AES-256-GCM with a key derived from the platform master key (Argon2id)
- Each connector type declares its auth schema in `connectors/<type>/auth-schema.json`
- The Dashboard masks secret fields (`********`) in all non-admin views
- API responses redact secret fields automatically (`/api/connectors/:id` omits `auth.fields`)

---

## Rate Limiting

| Layer | Limit | Scope |
|-------|-------|-------|
| **Plugin execution** | 10 executions/min per plugin | Global counter with sliding window |
| **Network egress** | 60 req/min per plugin | Counted across all allowed hosts |
| **Connector API calls** | Defined per connector type (see CONNECTOR_CATALOG.md) | Per-connector-instance |
| **Event bus** | 100 events/sec per plugin | Burst window; excess dropped |
| **Sandbox CPU** | 500ms/tick, 5s total/min | Hard cutoff; plugin disabled on repeated violation |

Rate limit violations are logged and increment a warning counter. After 3 warnings within 1 hour, the plugin is automatically disabled.

---

## Secret Redaction

| Location | Redaction Behavior |
|----------|-------------------|
| **Logs** | All fields marked `"secret": true` in auth schema are replaced with `[REDACTED]` |
| **Dashboard** | Secret fields display `••••••••` with a "show" toggle that requires re-authentication |
| **API responses** | Secret fields are stripped unless the request includes an `X-Show-Secrets: admin` header with valid admin token |
| **Error messages** | Secrets in stack traces and error payloads are regex-redacted (`/api-_[a-f0-9]{32,}/gi`) |
| **Config exports** | Plugin exports (for backup) replace secrets with placeholder `{{secret:<field>}}` |

---

## Approval Gates

New connectors from the marketplace require user approval before activation:

1. **Gate 1 — Marketplace metadata**: Connector name, author, downloads, rating displayed
2. **Gate 2 — Permission review**: Declared permissions listed with plain-language descriptions
3. **Gate 3 — Sandbox review**: (Enterprise only) Automated analysis of network origins, file access patterns
4. **Gate 4 — Admin confirmation**: Explicit click-through for `admin`-level permissions

Approval state is persisted per connector. Revoked approvals automatically disable the connector.

---

## Audit Log

Every security-relevant event is recorded:

| Event | Data | Retention |
|-------|------|-----------|
| Plugin install | `pluginId`, `version`, `permissions`, `timestamp` | 90 days |
| Permission grant | `pluginId`, `scope`, `level`, `grantedBy` | 90 days |
| Sandbox violation | `pluginId`, `violationType`, `detail` | 30 days |
| Rate limit warning | `pluginId`, `counter`, `limit`, `window` | 30 days |
| Connector auth change | `connectorId`, `method`, `timestamp` | 90 days |
| Approval action | `connectorId`, `action` (approve/reject/revoke), `userId` | 1 year |

Audit logs are append-only and stored encrypted in `storage/audit/`.
