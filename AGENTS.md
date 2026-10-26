# AGENTS.md — Scholar Suite Frontend

Multi-agent and agentic AI guidelines for the `lms_k12` Next.js project.
Read alongside `CLAUDE.md`, which governs all single-agent work.

---

## 1. When to use agents

Use an agent (via the AI Hub's Agent Management screen or the `app/api/agents/` routes) when:

- The task requires sequential, multi-step actions across modules (e.g. "identify fee defaulters → draft reminders → queue for approval").
- The task must be **recoverable** — it can be paused, resumed, and its intermediate state inspected.
- A human approval gate is required mid-task (e.g. "suggest marks adjustment → wait for teacher sign-off → publish").
- The task operates on data the chatbot does not have direct access to (e.g. bulk record processing).

Do **not** use an agent for: simple Q&A, single-step reads, or tasks that a direct API call or a chatbot turn handles cleanly.

---

## 2. Agent architecture in this project

```
User / Scheduler trigger
        │
        ▼
AgentController (Laravel: app/Http/Controllers/agenticAI/)
        │  runs the agent lifecycle, owns the tool list, holds no model key
        │
        ▼
ai_api_keys (central credentials) ──► AI Provider (Gemini / Claude / etc.)
        │
        ▼
Tool execution layer
  ├── Laravel API tools (fees, students, attendance, …)
  ├── MCP tools (app/Http/Controllers/Mcp/)
  └── Brain tools (app/Brain/)
        │
        ▼
Approval queue (ai_agent_approvals) ── Human sign-off if required
        │
        ▼
Audit trail (platform_audit_log)
```

### Key files (backend — Laravel project root)

| Path | Purpose |
|---|---|
| `app/Http/Controllers/agenticAI/` | Agent HTTP controllers |
| `app/Agents/` | Agent definitions, tool registries |
| `app/Brain/` | Enterprise Brain deliberation and execution layer |
| `app/Http/Controllers/Mcp/` | MCP tool handlers |
| `config/platform_services.php` | Shared platform service registry |
| `database/migrations/…add_ai_intelligence_menu…` | AI Hub menu rows |

### Key files (frontend — Next.js project root)

| Path | Purpose |
|---|---|
| `app/api/agents/` | Next.js proxy routes for agent management |
| `app/ai/[capability]/` | AI Hub capability screens (read from registry) |
| `packages/ai-intelligence-core/src/registry.ts` | AI capability registry (single source of truth) |
| `app/_components/ai-stack/` | Per-module AI Stack UI components |
| `app/enterprise-brain/` | Enterprise Brain screens |

---

## 3. Agent definition rules

When adding a new agent to the platform:

1. **Define in the registry first.** Add the agent's capability to `packages/ai-intelligence-core/src/registry.ts` with `status: 'live'` or `status: 'planned'`. The Agent Management screen auto-populates from this registry.
2. **One agent, one purpose.** Each agent has a single, named responsibility (e.g. `fee-reminder-drafter`, `attendance-anomaly-detector`). Do not create general-purpose agents.
3. **Declare the tool list explicitly.** Every tool an agent can call must be listed in its definition. Agents must not have open-ended tool access.
4. **Set an approval policy.** Specify whether each tool call requires human approval: `auto` (no approval), `supervised` (log only), or `gated` (explicit sign-off before execution). Write-affecting tools default to `gated`.
5. **Map to a model.** Every agent binds to a named model from the central `ai_models` catalogue. Never hardcode a model string in agent code.
6. **Set a timeout.** Agents that call external APIs or run bulk operations must have a configured timeout. Default: 120 seconds for interactive agents, 600 seconds for scheduled batch agents.

---

## 4. Tool authoring rules

Tools are the actions an agent can take. When writing a new tool:

- **Name**: `verb_noun` format in snake_case (e.g. `list_fee_defaulters`, `draft_reminder_message`).
- **Input schema**: define with Zod (frontend) or Laravel Validation (backend). Reject any tool call whose input does not pass schema validation.
- **Output**: always return `{ success: boolean, data?: unknown, error?: string }`. Never throw from a tool — catch and return `{ success: false, error: '...' }`.
- **Idempotency**: read tools are always safe. Write tools (send message, update record, generate receipt) must be idempotent or must use the approval queue to prevent double execution.
- **Audit**: every write tool must emit an audit event to `platform_audit_log` with `agent_id`, `tool_name`, `input_summary`, `output_summary`, and `user_id` of the approving human (if gated).
- **No secrets in tool parameters.** API keys, JWT tokens, and credentials are resolved inside the tool from the central `ai_api_keys` table — never passed as tool arguments.

---

## 5. MCP (Model Context Protocol) tools

MCP tools are defined in `app/Http/Controllers/Mcp/` (Laravel) and exposed to agents and the AI SDK.

- Each MCP tool handler must validate its input against a known schema before executing.
- MCP tools that modify data require the calling agent to have `gated` approval policy for that tool.
- MCP tools are not directly callable from the frontend — they are invoked by the agent runtime on the backend only.
- To add a new MCP tool: add the controller method, register it in the MCP manifest, and add the capability to the AI registry with `status: 'live'`.

---

## 6. Approval queue

All agent actions with approval policy `gated` write a row to `ai_agent_approvals` before executing. The frontend reads pending approvals via the AI Stack's Approval Queue screen (`app/_components/ai-stack/module-approval-queue.tsx`).

**Rules:**
- An approved action is executed exactly once. The approval record is marked `executed` immediately.
- A rejected action is marked `rejected` and logged. The agent receives a rejection signal and stops or asks for guidance.
- Approval records are never deleted — they are the audit trail for every agent-initiated write.
- Bulk approvals (approve all fee reminders at once) are allowed but must be confirmed with a count: "Approve 42 reminders to Class 10 defaulters."

---

## 7. Scheduled agents

Scheduled agents are triggered by the Platform Services Scheduler (`app/platform-services/scheduler/`).

- Each scheduled agent must have a named cron expression, a target module, and a last-run timestamp.
- Failed scheduled runs must write to the platform audit log and trigger a notification to the admin.
- Scheduled agents must be idempotent for the same trigger window — running the same job twice for the same day must not create duplicate records or send duplicate messages.
- Do not schedule AI jobs at minute-level frequency. Minimum interval: 15 minutes. Preferred: hourly or daily.

---

## 8. Agent UI patterns

When building UI for agent interactions:

- **Approval cards**: use the `ApprovalCard` component from the design system (`components/workflow/`). It shows the action, the affected record (with its ID), the agent that proposed it, and Approve / Reject buttons.
- **Agent status**: use `ActivityFeed` and `AuditEntry` components to show what an agent did and when.
- **Streaming agent output**: use the AI SDK's `useStreamableValue` or `useChat` hooks. Never poll for agent status — use SSE or the SDK's streaming primitives.
- **Error states**: if an agent run fails, show the `StatusView` component in error mode with a safe message. Log the full error server-side.
- **No raw JSON**: never display raw agent tool outputs to end users. Always render through a typed component.

---

## 9. Security for agents

- **No agent runs as a super-admin.** Agents inherit the permissions of the user who triggered them (or a service account with the minimum required rights).
- **RBAC applies to agent tools.** If a user cannot call the `list_fee_defaulters` API directly, an agent running on their behalf cannot call it either.
- **Validate all agent inputs** at the tool boundary. Do not trust the model's output as safe input to a database query.
- **Prompt injection**: any user-supplied text passed to an agent (e.g. a student's name, a fee comment) must be passed as a data parameter, not interpolated into the system prompt.
- **Credential isolation**: agents never see raw API keys. They call `resolveProviderClient(agentId)` which returns a ready client — the key stays in `ai_api_keys`.
- **Rate limiting**: each agent has a per-run and per-day API call budget set in its definition. Exceeding the budget stops the run and writes to the audit log.

---

## 10. Testing agents

- Unit test every tool function in isolation: given a valid input, assert the correct output and audit event.
- Integration test the agent lifecycle: trigger → tool calls → approval gate → execution → audit record.
- Use a test database and a mock AI provider (return a fixed response) for agent integration tests.
- Never run agent tests against the production backend (`https://dev.triz.co.in`).
- Test the approval queue explicitly: assert that a `gated` tool does not execute before the approval row is set to `approved`.
