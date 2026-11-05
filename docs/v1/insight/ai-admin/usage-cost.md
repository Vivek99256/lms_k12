# Usage & Cost

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Track AI token consumption and estimated cost per model, module, tenant, and time period. Provides visibility into how AI quota is being used and which features are driving the most cost.

---

## Menu path

AI Administration → Usage & cost

---

## Frontend route

| Route | Notes |
|---|---|
| `/ai/usage-cost` | Registry status: `live` |

---

## Data sources

| Table | Description |
|---|---|
| `ai_usage_events` | Per-call log: template slug, model, module, user, token counts, timestamp |
| `ai_daily_used_api` | Pre-aggregated daily totals per model and module for fast chart queries |

---

## Dashboard panels

### KPI tiles

| Metric | Description |
|---|---|
| Total calls | Number of AI calls in the selected period |
| Total tokens | Input + output tokens combined |
| Estimated cost | Calculated from model token prices set in the models catalogue |
| Active models | Number of distinct models used |

### Usage over time

Line chart showing daily token usage (input vs output) for the selected date range.

### By module

Bar chart showing which Scholar Suite modules consume the most tokens.

### By model

Table showing token breakdown and estimated cost per model.

### By template

Table showing which prompt templates are called most frequently and their cumulative cost.

---

## Filters

| Filter | Options |
|---|---|
| Date range | Custom date picker |
| Model | Drop-down from active models |
| Module | Drop-down from active modules |
| Tenant | Multi-tenant deployments: filter by institute (super-admin only) |

---

## Export

Excel export available for all tabular views. The export includes raw `ai_usage_events` rows for the selected filter set, suitable for cost-allocation reporting.

---

## Cost calculation

Estimated cost = (input tokens × model input price per 1 K tokens) + (output tokens × model output price per 1 K tokens). Token prices are configured in the models catalogue. Prices are estimates; actual billing may differ based on provider invoicing terms.

---

## RBAC

| Action | Required right |
|---|---|
| View usage & cost | `ai_intelligence.usage-cost` |
| Export | `ai_intelligence.usage-cost` (write) |

---

## Related capabilities

- `models` — token prices per model are set in the models catalogue
- `audit` — per-call logs also appear in the AI audit log
- `prompts` — cost is attributed to template slugs

---

## Source files

- Registry: `packages/ai-intelligence-core/src/registry.ts` (capability `usage-cost`, status `live`)
- Backend tables: `ai_usage_events`, `ai_daily_used_api`
