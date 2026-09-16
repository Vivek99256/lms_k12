# Conversational AI Architecture

## Current runtime

Conversational AI is owned by Laravel's governed twelve-stage lifecycle. The browser
posts to `app/api/ai/ask/stream`, a thin Next.js transport that forwards the caller's
scope to Laravel and converts its SSE events into AI SDK UI-message chunks.

Laravel performs intent/module resolution, permission checks, MCP tool execution,
auditing and answer composition. Next.js renders the resulting answer, lifecycle trace,
citations and actions through `lib/intelligence/ask-adapter.ts` and
`lib/intelligence/ask-stream.ts`.

## Retired Next.js brain

The former client-side/shared orchestration modules have been retired:

- `conversation.ts`
- `planner.ts`
- `tools.ts`
- `model.ts`
- `discovery.ts`

They must not be reintroduced as a second conversational path. The only local model use
is `lib/ai/local-model.ts`, called by the deliberately stateless field-edit helper; it
cannot read ERP data, invoke MCP tools or persist records. Its boundary is documented in
`docs/AI_FIELD_ASSISTANT.md`.
