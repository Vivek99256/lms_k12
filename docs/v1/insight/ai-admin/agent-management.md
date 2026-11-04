# Agent Management

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Configure, monitor, and trigger autonomous AI agents across all Scholar Suite modules. Agents automate recurring tasks (e.g. fee reminder drafting, attendance anomaly alerts) and are logged under the calling user's identity for audit purposes.

---

## Menu path

AI Administration → Agent management  
(Also accessible per-module: Module → AI Stack → Automations)

---

## Frontend route

| Route | Component | Notes |
|---|---|---|
| `/enterprise-brain/automation/agents` | `AgentManagement` + `DomainAgentPanel` + `ModulePicker` | Registry status: `in-progress` |

Source: `app/enterprise-brain/automation/agents/page.tsx`

---

## Two-panel layout

### Module picker

A `ModulePicker` at the top lets administrators filter agents by Scholar Suite module (Fees, Admissions, Attendance, etc.). When a module is selected, the `AgentManagement` component shows only agents belonging to that module — the same view a module admin sees in their own AI Stack → Automations tab.

### Domain agent panel

The `DomainAgentPanel` shows the cross-module "domain agents" — agents that operate across module boundaries (e.g. an attendance + fees correlation agent). These are distinct from module-scoped agents and are managed exclusively from this central screen.

---

## Agent record fields

| Field | Notes |
|---|---|
| Name | Display name |
| Module | Owning module key (e.g. `fees`, `attendance`) |
| Trigger type | `scheduled`, `event`, `manual` |
| Schedule | Cron expression (for scheduled triggers) |
| Event key | Backend event slug (for event triggers) |
| Prompt template slug | References a published template in the Prompt Management catalogue |
| Status | active / paused / archived |
| Run as | Always the calling authenticated user — agents do not run as a system account |

---

## Run log

Every agent execution is recorded in `agent_run_logs`:

| Column | Notes |
|---|---|
| `agent_id` | Reference to the agent record |
| `run_at` | Timestamp |
| `triggered_by` | User ID of the user who triggered (or the scheduler user) |
| `status` | success / failure / partial |
| `tokens_used` | Charged against the calling user's institute quota |
| `output_summary` | Short summary of what the agent produced |

The run log is accessible from the Agent Management screen (expand a row) and from the Reports → Agent Run Log report.

---

## Roadmap note

A displayed note (not a "coming soon" badge) explains that the agent library is becoming a shared service (`ai.agentic-library` on the product roadmap). Once released, agents authored here will be available to all institutes on the platform rather than being per-institute configurations. Existing agents are forward-compatible.

---

## RBAC key

`agents.<module>` — e.g. `agents.fees`, `agents.attendance`. The central screen requires write access to at least one module agent RBAC key, or the domain agents key.

---

## Related capabilities

- `prompts` — agents reference prompt templates by slug
- `usage-cost` — agent token consumption is attributed per run
- `audit` — all agent runs are logged in the AI audit trail
- `conversational` — domain agent responses may be surfaced through the chatbot

---

## Source files

- Frontend: `app/enterprise-brain/automation/agents/page.tsx`
- Agent store: `lib/agents/` (JSON-file adapter now; Laravel adapter later)
- Backend table: `agent_run_logs`
- Registry: `packages/ai-intelligence-core/src/registry.ts` (capability `agents`, status `in-progress`)
