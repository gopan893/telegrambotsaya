# Render Deploy Gate

## Checks

| Check | Method | Failure |
|---|---|---|
| Start command | `checkRenderStartCommand` | Start script missing or not using node |
| package.json start | `checkPackageJsonStartScript` | No start script or wrong entry point |
| Node version | `checkNodeVersionCompatibility` | Engine requires <> 20 |
| Runtime files | `checkRequiredRuntimeFiles` | telebot.js or package.json missing |
| Optional fallbacks | `checkOptionalModuleFallbacks` | Optional modules may crash startup |
| Port binding | `checkRenderPortBinding` | PORT env not used |

## Required Env (names only)
- TELEGRAM_TOKEN
- OWNER_CHAT_ID
- DASHBOARD_ADMIN_TOKEN
- PORT (set by Render)

## Rules
- Never expose env values
- Missing optional env must not crash app
- Missing required env blocks deploy
- All gate checks must pass before deploy proposal
