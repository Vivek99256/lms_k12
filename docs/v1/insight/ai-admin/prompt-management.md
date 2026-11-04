# Prompt Management

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Central library of AI prompt templates used across all Scholar Suite modules. Administrators author, version, and publish templates; individual modules reference them by slug rather than embedding prompt text in code.

---

## Menu path

AI Administration → Prompt management

---

## Frontend route

| Route | Component | Notes |
|---|---|---|
| `/ai/prompts` | `CapabilityShell slug="prompts"` + `TemplateList` | Route slug is `prompts` (not `template-management`) because ~7,600 rows in `tblgroupwise_rights` reference `ai_intelligence.prompts` — renaming would silently revoke access for existing role groups |

Source: `app/ai/prompts/page.tsx`

---

## Template record fields

| Field | Type | Notes |
|---|---|---|
| Name | string | Human-readable label shown in module AI Stack screens |
| Slug | string | Machine identifier used by backend controllers to load the template |
| Module | enum | Which Scholar Suite product this template belongs to |
| Capability | enum | Which AI capability type (chat, summarise, generate, classify, …) |
| System prompt | rich text | The instruction sent to the model as the system role |
| User prompt template | rich text | Mustache-style placeholders (e.g. `{{student_name}}`, `{{fee_amount}}`) filled at runtime |
| Variables | JSON array | Declares expected placeholders, their types, and whether they are required |
| Model override | optional | Pin this template to a specific model from the models catalogue |
| Status | draft / published / archived | Only published templates are callable at runtime |
| Version | integer | Auto-incremented on each publish; previous versions are retained for audit |

---

## Authoring workflow

1. Create a template in **draft** status.
2. Test it via the built-in preview panel (enter sample variable values, call the model, inspect output).
3. Publish — version counter increments; the previous published version is kept as `v(n-1)` and remains accessible to the audit capability.
4. If a published template needs correction, edit it in place (creates a new draft) or fork it.
5. Archiving a template prevents new calls; existing runs that already used it are unaffected.

---

## Runtime resolution

When a backend controller calls the AI layer, it passes a `template_slug` and a `variables` map. The AI layer:

1. Looks up the latest published template by slug.
2. Checks the module's model override → institute default → system default to pick the model.
3. Renders the system and user prompts by filling in the variables.
4. Sends to the model and streams or returns the response.
5. Logs the call to `ai_interaction_logs` with the template slug, model used, token counts, and response time.

---

## RBAC

| Action | Required right |
|---|---|
| View templates | `ai_intelligence.prompts` |
| Create / edit draft | `ai_intelligence.prompts` (write) |
| Publish template | `ai_intelligence.prompts` (write) |
| Archive template | `ai_intelligence.prompts` (write) |

---

## Related capabilities

- `models` — model override per template is selected from the models catalogue
- `audit` — every template publish and every runtime call is logged
- `usage-cost` — cost is attributed to the template slug in usage reports

---

## Source files

- Frontend: `app/ai/prompts/page.tsx`
- Backend table: `ai_prompt_templates`, `ai_interaction_logs`
