# Universal Conversational AI Platform

## 1. Vision

Build one reusable conversational runtime that stays identical across projects while each project contributes only:

- authentication and trusted session context
- backend discovery sources
- permission model
- project tools and MCP tools
- data connectors
- UI composition and branding

The core runtime must support:

- natural chat and general knowledge
- project-specific operations
- multilingual interaction
- voice I/O
- MCP tool discovery and execution
- model access owned by the backend, behind a single provider key
- streaming, memory, analytics, and auditability

## 2. Architecture

```text
+------------------------+       +------------------------------+
| Reusable Frontend UI   | ----> | Next.js AI Route Handlers    |
| chat, voice, uploads   |       | streaming, auth bridge       |
+------------------------+       +--------------+---------------+
                                                 |
                                                 v
+------------------------+       +------------------------------+
| Universal AI Core      | <---- | Project Adapter Resolver     |
| router, memory, tools  |       | lms_k12, g2g, erp, crm       |
+-----------+------------+       +--------------+---------------+
            |                                           |
            v                                           v
+------------------------+       +------------------------------+
| Discovery Layer        |       | Security Layer               |
| routes, services, db   |       | RBAC, policy, audit, guard   |
+-----------+------------+       +--------------+---------------+
            |                                           |
            +-------------------+-----------------------+
                                |
                                v
                    +------------------------------+
                    | Execution Layer              |
                    | API tools, DB tools, MCP     |
                    +--------------+---------------+
                                   |
                                   v
                    +------------------------------+
                    | Current Project Backend Only |
                    | isolated routes and data     |
                    +------------------------------+
```

## 3. Runtime Flow

```text
User -> UI -> /api/ai/ask/stream
     -> Next.js SSE translation only
     -> Laravel lifecycle API
     -> trusted scope and permission resolution
     -> intent and module resolution
     -> Laravel MCP tool execution
     -> lifecycle trace, audit and telemetry
     -> streamed answer and stage updates
```

## 4. Universal Package Layout

```text
packages/
  conversational-ai-core/
    src/
      audit.ts
      context.ts
      conversation-focus.ts
      entity-selection.ts
      followup-state.ts
      history.ts
      memory.ts
      response-schema.ts
      schemas.ts
      security.ts
      types.ts
lib/
  ai/
    local-model.ts
    mcp-client.ts
  intelligence/
    ask-adapter.ts
    ask-stream.ts
docs/
  conversational-ai-architecture.md
  universal-conversational-ai-platform.md
```

## 5. Folder Responsibilities

- Laravel owns request preparation, tool orchestration, response generation, streaming,
  discovery and routing through its governed lifecycle.
- `memory.ts`: short-term and long-term memory contracts.
- `security.ts`: prompt-injection and tool-execution guard contracts.
- `lib/intelligence/ask-stream.ts`: translates Laravel's SSE events into AI SDK UI
  message chunks; it never plans, calls a model or executes a tool.
- `lib/ai/local-model.ts`: the bounded provider factory for non-conversational local
  helpers such as field editing.

## 6. Dynamic Backend Discovery

Dynamic behavior comes from Laravel's module registry and MCP tool registry, not from
an indexed Next.js project snapshot or ad hoc route lists in prompts.

Recommended discovery sources at startup or build time:

1. OpenAPI or Swagger parser
2. source-code parser for controllers, routes, DTOs, validators
3. ORM schema parser for Prisma, Drizzle, TypeORM, Sequelize, Mongoose
4. permission registry parser
5. MCP tool registry parser

Output:

- `ProjectDiscoverySnapshot`
- versioned and timestamped
- tenant-safe and project-safe
- cached in Redis or filesystem artifact

## 7. Discovery Pipeline

```text
startup/build
  -> scan controllers and routes
  -> scan DTOs and validators
  -> scan services and repositories
  -> scan ORM models and database schema
  -> scan permission metadata
  -> scan MCP tools
  -> normalize to ProjectDiscoverySnapshot
  -> persist index
  -> serve to AI router and tool planner
```

## 8. Intelligent Routing

The router should evaluate:

- intent type
- detected language
- current route/screen context
- user role and permissions
- discovery snapshot capability matches
- tool risk level
- confirmation requirement

Routing outcomes:

- answer directly with LLM
- answer with retrieved project context
- invoke project API tool
- invoke MCP tool
- require human confirmation
- deny by policy

## 9. Model access, and what the Vercel AI SDK is for

This section previously described the client calling Gemini directly — `streamText`
for conversation, `generateObject` for intent classification, the `@ai-sdk/google`
provider in the browser tier. None of that is the runtime any more, and the change is
the point of the architecture rather than an implementation detail.

**Model access lives in the backend.** Laravel selects one driver through
`AI_PROVIDER` (`gemini` | `openrouter` | `deepseek`) and holds the only key that
matters; see `config/ai.php`. A turn's model call happens there, inside the governed
lifecycle, where it is scoped to a tenant, audited, and bounded by the tools the
module is bound to. The client holds no key for conversation and cannot reach a model
on its own.

**Intent classification is deterministic, not generated.** `IntentClassifier` matches
anchors, weighted signals and full-phrase patterns, and the planner routes on the
result. `generateObject` is not involved: an approval records a decision against a
student's record, and a route that can differ on a Tuesday is not one you can replay.

**The SDK is the transport and render layer.** `@ai-sdk/react`'s `useChat` owns the UI
message protocol, streaming state and aborts — and nothing else. It never decides what
a turn means. Concretely:

- Laravel streams named SSE events — `stage`, `token`, `done`, `error`.
- `app/api/ai/ask/stream` is a thin proxy that forwards the question upstream and
  translates that dialect into UI message chunks. It runs no model, selects no tools,
  and takes its upstream host from the server's own environment, never the request.
- Lifecycle stages arrive as typed data parts while the turn runs, so the twelve-stage
  ladder fills in row by row instead of appearing complete at the end.
- `lib/intelligence/ask-adapter.ts` renders both a finished turn and a partial one
  through one composition, so a turn does not change appearance the moment it lands.

**One deliberate exception.** Field editing (`app/api/ai/field-edit`) still calls a
model locally through `@ai-sdk/google`, because it is a stateless text transform over
one form field: it reads no ERP data, invokes no tools, persists nothing, and needs an
immediate single value. Routing it through the lifecycle would make a form helper
appear to have inspected school records when it has not. If Laravel grows an equally
narrow field-edit endpoint, this becomes a proxy like the rest.

Of the production additions this section used to recommend, **abort propagation is
implemented**: the browser's cancel travels through the proxy to Laravel via the
request signal, so stopping a turn stops the work rather than only closing the
browser's ear. Model tier routing, retry policy and per-tenant token budgeting belong
to the backend's provider configuration, not to the client.

## 10. MCP Architecture

Keep MCP as a first-class execution path:

- MCP server exposes project-safe tools only
- MCP client authenticates using trusted server credentials
- tool registry enriches discovery snapshot
- router may prefer MCP for cross-system workflows or higher-level actions

MCP sequence:

```text
AI router -> tool decision -> MCP client -> MCP server -> validated tool execution
         -> streaming partial events -> structured result -> assistant response
```

## 11. Conversation and Memory

Memory layers:

- request memory: current turn
- session memory: active conversation window
- summary memory: rolling conversation summary
- long-term memory: opt-in persisted preferences and business context

Context window policy:

- always keep latest user turn and latest tool results
- summarize older turns once threshold is reached
- isolate memory by `projectId`, `orgId`, `userId`, and `sessionId`

### 11.1 Module workflow state and record memory

Multi-step module workflows (admission confirmation, fee collection, homework
review, …) share one state machine and one record memory. Nothing about a module
is special-cased in the conversation loop:

```text
tool result ──► extractModuleRecords(tool, result)      module-records.ts
                     │  real backend rows -> WorkflowEntitySummary[]
                     ▼
             workflow state (workflow-state.ts)
             matchedEntities + selectedEntity + selectedRecord
                     │
   user reply ──► resolveEntitySelection(message, entities)   entity-selection.ts
                     │  number | ordinal | name | name+standard
                     │  name+reference | full displayed line | reference
                     ▼
             buildToolInputCandidates(nextTool, selectedRecord)   module-records.ts
                     │  structured input for the next tool, from the record
                     ▼
             tool execution ──► buildRecordNavigation(module, record)
                                  existing module route + query
```

Rules that hold for every module:

- A record returned by a tool is stored verbatim under `selectedRecord`, using
  the field names the module's own API returns. Nothing is invented.
- The next tool's input is projected from that record, never re-parsed from the
  user's sentence. `requires_input` is therefore only possible when neither the
  message nor the stored record carries a usable identifier.
- Projections are ordered from most to least specific; if the strictest filter
  matches nothing, the looser projections of the *same* record are retried
  before the assistant asks the user anything.
- Modules with a hydration tool (`fees`, `admissions`) re-resolve the full
  record through their own backend before acting; modules whose list rows are
  already complete (`homework`, `students`) act immediately.
- When a single record resolves, the response is `navigation_required` and
  carries the existing application route plus the structured record, so the
  destination page opens with the right record selected.

## 12. Multilingual and Voice

Multilingual:

- detect language on each turn
- answer in same language unless user switches
- store canonical tool arguments in neutral structured format
- translate only the response surface, not permission rules

Voice:

- STT route
- TTS route
- interruption support
- voice activity state in UI hook
- streaming transcription and synthesis where infrastructure supports it

## 13. Security Model

- never accept project identity from the prompt
- resolve project from trusted server config and auth context
- isolate all discovery snapshots by project
- require explicit permission validation before tool execution
- protect against prompt injection by sanitizing tool-visible context
- log every tool plan and tool execution
- enforce confirmation for medium/high-risk mutations

## 14. Observability

Capture:

- request ID and session ID
- adapter ID
- intent classification result
- router decision
- selected tools
- tool latency
- model latency
- token usage
- failure category
- user feedback signal

Send to:

- application logs
- metrics backend
- tracing backend
- AI analytics dashboard

## 15. Frontend Architecture

Reusable components:

- `ChatbotPanel`
- message list with markdown and code rendering
- streaming token renderer
- voice controls
- history drawer
- upload zone
- inline citations and tool activity chips

Client hooks:

- `use-voice-interaction.ts`
- `useChat` integration
- abort and reconnect handling
- optimistic assistant placeholder for streaming

## 16. Backend Modules

- Chat Module: route handlers, streaming, normalization
- Discovery Module: build and refresh discovery index
- Tool Module: API, database, and MCP tool wrappers
- Memory Module: history and summary store
- Security Module: RBAC and prompt guards
- Voice Module: STT, TTS, voice session config
- Analytics Module: audit, usage, feedback

## 17. Example Project Adapter Pattern

Each adapter should implement:

- `resolveContext`
- `classifyIntent`
- `buildSystemPrompt`
- `getToolDefinitions`
- `getAllowedToolNames`
- `validatePermission`

Each adapter should optionally add:

- discovery provider registration
- tool confirmation policy
- tenant-specific rate limits
- project-specific memory policy

## 18. New Project Integration Guide

For `ERP`, `CRM`, `HRMS`, `Hospital`, `Banking`, or `Ecommerce`:

1. Install shared packages.
2. Create `lib/ai/adapters/<project-id>/adapter.ts`.
3. Register the adapter in `project-resolver.ts`.
4. Implement discovery providers for routes, services, schema, permissions, and MCP tools.
5. Map project auth context into trusted session context.
6. Add project tools that call only local project APIs.
7. Enable UI entry points and project branding.

## 19. Migration Guide

From an existing project-specific chatbot:

1. Extract prompt logic into shared core or adapter.
2. Replace hardcoded endpoint selection with discovery-indexed tool selection.
3. Move session and permission logic into trusted context resolution.
4. Wrap existing APIs as tool definitions.
5. Add audit and telemetry.
6. Cut over feature-by-feature using an adapter flag.

## 20. CI/CD and Testing

Testing layers:

- unit tests for intent rules, router scoring, tool wrappers
- contract tests for adapters
- schema tests for discovery snapshots
- integration tests for route handlers and streaming
- security tests for injection, permission bypass, and tenant isolation
- load tests for streaming and concurrent sessions

CI pipeline:

```text
lint -> typecheck -> unit tests -> integration tests -> build
    -> discovery snapshot validation -> security tests -> deploy
```

## 21. Deployment

Docker:

- Next.js app image
- optional worker image for discovery refresh and summarization jobs
- Redis for cache and short-term memory

Kubernetes:

- web deployment
- worker deployment
- Redis
- ingress with streaming support
- secret manager integration
- HPA on request concurrency and CPU

## 22. Environment Variables

`.env.example` is the contract, on both sides — this section deliberately does not
restate it, because the copy in this document had drifted to the point where seven of
its twelve keys were read by nothing (`AI_PROJECT_ID`, `AI_MODEL_PRIMARY`,
`AI_MODEL_REASONING`, `AI_DISCOVERY_CACHE_TTL_SECONDS`, `AI_MEMORY_PROVIDER`,
`REDIS_URL`, `MCP_SERVER_URL`, `MCP_AUTH_TOKEN`). A list of variables in prose has no
way to fail when it stops being true; the example files sit next to the code that
reads them.

- **Client** — `lms_k12/.env.example`: where the backend is, the one local model key
  for field edit, and nothing else. No conversational model key lives here.
- **Backend** — `next_lms_erp/.env.example`: `AI_PROVIDER` selects one driver and that
  driver owns the only conversational model key, plus the `AI_*` lifecycle settings
  and the `MCP_*` server settings.

Model access, memory and tool execution are the backend's (§9), so the keys that used
to appear here for discovery caching, a Redis memory provider and a separately
addressed MCP server have no client-side counterpart to configure.

## 23. Best Practices

- keep the AI core stateless where possible
- treat discovery output as the contract between project code and AI runtime
- never expose raw DB mutation tools without confirmation and policy checks
- prefer API and service tools over direct SQL generation
- store structured tool outputs for follow-up turns

## 24. Performance Optimization

- cache discovery snapshots
- cache permission maps
- use smaller models for intent and extraction
- keep tool outputs compact and structured
- summarize history aggressively
- stream early and often

## 25. Production Readiness Checklist

- adapter registered and isolated per project
- discovery snapshot generated successfully
- tool permissions validated server-side
- prompt injection guard enabled
- audit logs enabled
- rate limits configured
- Redis or durable memory provider configured
- health endpoints for AI and MCP available
- load test completed with streaming enabled
- fallback path tested for model quota failure

## 26. Current Workspace Status

Implemented in `D:\lms_k12`:

- shared AI core package with conversation runtime
- registry-driven project adapter resolution
- discovery, router, memory, and security contracts
- LMS-specific adapter and tools
- Next.js AI route handlers
- voice route handlers
- MCP capability and tool-call route handlers

Next recommended implementation steps:

1. add a real discovery snapshot builder for LMS source artifacts and OpenAPI
2. externalize remaining LMS capability heuristics into discovery metadata
3. move memory from in-process storage to Redis
4. add adapter registration for `g2g` and `next_lms_erp`
5. add automated tests around routing, permission validation, and tool execution
