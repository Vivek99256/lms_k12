# AI Audit

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Immutable log of every AI interaction and administrative action across all Scholar Suite AI capabilities. Provides the evidence trail required for governance, compliance, and debugging.

---

## Menu path

AI Administration → AI audit  
(Also: Interactions → AI Stack)

---

## Frontend routes

| Route | Description | Registry status |
|---|---|---|
| `/ai/audit` | AI Administration audit log — full detail view | `coming-soon` |
| `/interactions/ai-stack` | AI interaction log — module-scoped view | Assigned to Insight (confirmed in unmapped resolution) |

---

> **Status of `/ai/audit`:** The screen is planned; the underlying log tables (`ai_interaction_logs`, `mcp_audit_logs`) are already populated by every AI call. The administration-level audit screen with full detail is `coming-soon` in the registry. The `/interactions/ai-stack` module-scoped view is available now.

---

## What is logged

### Per AI call (`ai_interaction_logs`)

| Column | Notes |
|---|---|
| `id` | Record identifier |
| `institute_id` | Multi-tenant scope |
| `user_id` | Calling user (or scheduler user for agent runs) |
| `module` | Scholar Suite module key |
| `template_slug` | Prompt template used |
| `model_id` | Model that handled the call |
| `input_tokens` | Tokens in the prompt |
| `output_tokens` | Tokens in the response |
| `latency_ms` | End-to-end response time |
| `status` | success / error / rate_limited |
| `error_code` | Populated on failure |
| `created_at` | Timestamp |

Note: raw prompt text and response content are **not** stored in this table by default (privacy by design). If forensic content logging is enabled per institute, content is stored in an encrypted column.

### Administrative actions (`mcp_audit_logs`)

Covers: provider key creation/update/delete, model configuration changes, template publish/archive, policy create/retire, knowledge base upload/re-index, agent enable/disable. Each row records the actor, action, affected resource, before/after values (for changes), and timestamp.

---

## Filters

| Filter | Options |
|---|---|
| Date range | Custom date picker |
| User | Search by name |
| Module | Drop-down |
| Interaction type | AI call / admin action / agent run / policy event |

---

## Export

Excel export of filtered log rows. Includes all columns above. Suitable for compliance reporting.

---

## Retention

Log retention period is configured in `config/ai.php` on the Laravel side. Default is 90 days for interaction logs and 365 days for administrative action logs.

---

## RBAC

| Action | Required right |
|---|---|
| View audit log | `ai_intelligence.audit` |
| Export | `ai_intelligence.audit` (write) |

---

## Related capabilities

- All other AI capabilities write to these tables — audit is a passive consumer of their output
- `guardrails` (coming-soon) — policy enforcement events also land in `mcp_audit_logs`

---

## Source files

- Registry: `packages/ai-intelligence-core/src/registry.ts` (capability `audit`, status `coming-soon`)
- Backend tables: `ai_interaction_logs`, `mcp_audit_logs`
