# AI Policies

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Governance rules that control how AI-generated content is used within assignments and assessments. Policies can require student disclosure of AI use, mandate detection checks, and enforce plagiarism thresholds.

---

## Menu path

AI Administration → AI policies

---

## Frontend route

| Route | Component | Notes |
|---|---|---|
| `/ai/policies` | Full CRUD policy form + `ModulePicker` | Registry status: `coming-soon` |

Source: `app/ai/policies/page.tsx`

---

> **Status:** This screen is built and functional for administration, but the enforcement pipeline (applying policies at assignment-submission time) is marked `coming-soon` in the AI capability registry. Policy records can be authored and assigned now; runtime enforcement activates when the pipeline is released.

---

## Policy record fields

### Core identity

| Field | Type | Notes |
|---|---|---|
| Name | string | Display name shown in module AI Stack → Policies tabs |
| Description | text | Purpose and scope |
| Policy type | enum | `ai_assisted` plus additional types returned by the API |
| Status | boolean | 1 = active, 0 = inactive |

### Disclosure rules

| Field | Type | Notes |
|---|---|---|
| Require disclosure | boolean | Student must acknowledge AI was used before submitting |
| Require acknowledgement | boolean | Separate acknowledgement step (distinct from disclosure) |

### Detection settings

| Field | Type | Notes |
|---|---|---|
| AI detection required | boolean | Trigger AI-content detection on submission |
| Plagiarism check required | boolean | Trigger plagiarism check on submission |
| Detection provider | enum | `Turnitin` or `Copyleaks` |
| Detection threshold | percentage | Submissions above this percentage are flagged |

### Rules

A set of toggle switches loaded from a `rule_catalogue` on the backend. Each rule is a named policy dimension (e.g. "Block submission if AI score exceeds threshold", "Notify teacher on flag"). The catalogue is defined server-side; the frontend renders whatever the API returns.

### Assignments (scope)

Policies are scoped to one or more objects via the `assignments` array:

| Field | Type | Notes |
|---|---|---|
| Scope type | enum | `institute`, `department`, `class`, `assignment` |
| Scope ID | integer | ID of the scoped object |
| Status | boolean | Whether this scope assignment is active |

---

## CRUD actions

| Action | Description |
|---|---|
| Add | Create new policy in draft; activate by setting status = 1 |
| Edit | Modify any field; changes take effect on next submission check |
| Retire | Set status = 0 and remove from active scope assignments; historical records are preserved |

---

## Module filter

The `ModulePicker` component at the top of the screen filters the policy list by module. This is the same `fetchAiPolicies(moduleKey)` function called by each module's own AI Stack → Policies tab, so a policy authored here appears immediately in the module-level view without any sync step.

---

## RBAC

| Action | Required right |
|---|---|
| View policies | `ai_intelligence.policies` |
| Create / edit / retire | `ai_intelligence.policies` (write) |

---

## Related capabilities

- `audit` — policy creation, edits, and enforcement events are logged
- `guardrails` — runtime enforcement of detection thresholds (coming-soon)
- `evaluation` — policy compliance metrics will appear in the evaluation capability (coming-soon)

---

## Source files

- Frontend: `app/ai/policies/page.tsx`
- Backend table: `ai_policies`, `ai_policy_assignments`
- Registry: `packages/ai-intelligence-core/src/registry.ts` (capability `policies`, status `coming-soon`)
