# AI Providers & Models

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Centralised configuration for all AI providers (API keys, endpoints) and model selection per module. Administrators register one or more providers, then assign specific models to each module's AI features.

---

## Menu path

AI Administration → Providers / AI Administration → Models

---

## Frontend routes

| Route | Component | Description |
|---|---|---|
| `/ai/providers` | `CapabilityShell slug="providers"` + `ConfigurationManager` | Manage API keys and provider endpoints |
| `/ai/models` | `CapabilityShell slug="models"` + `ModelManager` + `ModuleModelOverrides` | Global model selection and per-module overrides |

Source: `app/ai/providers/page.tsx`, `app/ai/models/page.tsx`

---

## Providers screen

### What it configures

Each provider record holds:
- Provider name (e.g. Google Gemini, OpenAI, Anthropic)
- API key (write-only after save — displayed as a masked preview only)
- Endpoint URL override (optional, for self-hosted or proxied deployments)
- Status (active / inactive)

### Key behaviour

- API keys are stored in the `ai_api_keys` table on the Laravel side.
- The read endpoint returns only a masked preview (e.g. `sk-...Xr4j`). The raw key is never returned to the frontend.
- Switching a provider inactive disables all models associated with it; active module assignments show a warning.
- The `ConfigurationManager` component is shared with other platform-services configuration screens.

---

## Models screen

### Global model catalogue

The `ModelManager` component shows all models available across registered providers. Each model entry has:

| Field | Notes |
|---|---|
| Model ID | Canonical identifier stored in `config/ai.php` on Laravel |
| Provider | Parent provider record |
| Display name | Human-readable label shown in module UIs |
| Input token limit | Used by the usage-cost capability to estimate costs |
| Output token limit | — |
| Status | active / deprecated / retired |
| Capability flags | Flags indicating which AI capabilities this model supports (e.g. chat, embeddings, vision) |

### Module model overrides

The `ModuleModelOverrides` section below the global catalogue allows administrators to assign a different model for a specific module's AI features. Override precedence (highest to lowest):

1. Per-module override (set here)
2. Institute-wide default (set in the global catalogue row)
3. System default (defined in `config/ai.php`)

This means a school can run a cheaper model for routine fee reminders but a higher-capability model for PAL content generation.

### Retired model mapping

`config/ai.php` on the Laravel side maps retired model IDs to their current replacements. If a module still references a retired ID, the backend silently routes to the mapped replacement and logs a deprecation warning. No frontend change is needed when a provider retires a model ID.

---

## RBAC

| Action | Required right |
|---|---|
| View providers | `ai_intelligence.providers` |
| Add / edit / delete provider | `ai_intelligence.providers` (write) |
| View models | `ai_intelligence.models` |
| Set module override | `ai_intelligence.models` (write) |

---

## Related capabilities

- `usage-cost` — reports cost per model; relies on model token-price data set here
- `audit` — provider and model changes are logged to the AI audit trail
- `knowledge-rag` — embedding model is selected per knowledge base from the models catalogue

---

## Source files

- Frontend: `app/ai/providers/page.tsx`, `app/ai/models/page.tsx`
- Backend config: `config/ai.php` (Laravel)
- Backend table: `ai_api_keys`
