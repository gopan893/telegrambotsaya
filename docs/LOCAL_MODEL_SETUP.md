# Local Model Setup

## Prerequisites
- Local AI server running (OpenAI-compatible or Ollama)
- env vars configured

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOCAL_AI_ENABLED` | Enable local AI | `false` |
| `LOCAL_AI_PROVIDER` | `openai_compatible` or `ollama` | `openai_compatible` |
| `LOCAL_AI_BASE_URL` | Base URL of local AI server | `http://localhost:11434` |
| `LOCAL_AI_API_KEY` | API key (if required) | `` |
| `LOCAL_AI_DEFAULT_MODEL` | Default model name | `local-model` |
| `LOCAL_AI_VISION_MODEL` | Vision model name | `` |
| `LOCAL_AI_CODING_MODEL` | Coding model name | `` |
| `LOCAL_AI_TIMEOUT_MS` | Request timeout | `30000` |
| `LOCAL_AI_MAX_TOKENS` | Max tokens per request | `2048` |
| `LOCAL_AI_PRIVACY_MODE` | Privacy mode | `high` |

## Providers Supported
- **OpenAI-compatible**: LocalAI, LM Studio, vLLM, Text Generation Inference
- **Ollama**: Any Ollama-served model

## Notes
- Local adapter is optional and fails softly.
- No auto-install or shell commands.
- Connection errors do not crash the app.
