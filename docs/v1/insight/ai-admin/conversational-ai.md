# Conversational AI

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Configure the Scholar chatbot assistant — context sources, greeting behaviour, and which modules the assistant is active in. The chatbot is a presentation layer; this screen controls what it knows and where it appears.

---

## Menu path

AI Administration → Conversational AI

---

## Frontend route

| Route | Notes |
|---|---|
| `/ai/conversational` | Registry status: `live` |

---

## Architecture constraint

`ChatbotPanel.tsx` is a **presentation component only** — it contains no model, no tool list, and no API key. It streams responses from `/api/ai/ask/stream`. All model selection, context injection, and tool registration happens server-side. This screen configures the server-side behaviour that the chatbot presents.

---

## Configuration areas

### Context sources

Which data sources the assistant can draw on when answering questions:

| Source | Description |
|---|---|
| Knowledge base (RAG) | Indexed document store; see Knowledge & RAG capability |
| Live LMS data | Real-time queries to the institute's own data (attendance, fees, marks) |
| Prompt templates | Named conversation starters and system context injected per module |
| Knowledge graph | Concept and entity relationships (in-progress) |

### Module activation

Toggle the chatbot on or off per Scholar Suite module. When enabled for a module, the chatbot panel appears on that module's pages and receives module-specific context (current page, relevant student/class IDs).

### Greeting and persona

| Field | Notes |
|---|---|
| Assistant name | Displayed in the chatbot header |
| Greeting message | First message shown when the panel opens |
| Suggested prompts | Quick-start questions shown as chips below the greeting |
| Tone | Formal / friendly / concise |

### Session settings

| Field | Notes |
|---|---|
| Session memory | How many prior turns to include in the context window |
| Max response length | Token limit for a single response |
| Fallback message | Shown when the model declines or errors |

---

## Shared runtime package

The chatbot runtime is implemented in `packages/conversational-ai-core`. This package is shared across all three Scholar AI solutions (lms_k12, g2g, enterprise_brain). Configuration changes made here affect the lms_k12 solution; g2g and enterprise_brain have their own configuration screens drawing from the same package.

---

## RBAC

| Action | Required right |
|---|---|
| View conversational AI config | `ai_intelligence.conversational` |
| Edit config | `ai_intelligence.conversational` (write) |

---

## Related capabilities

- `knowledge-rag` — document store that the chatbot draws on
- `knowledge-graph` — entity relationships (in-progress)
- `prompts` — module-specific system prompts are managed in Prompt Management
- `audit` — all chat sessions are logged in the AI audit trail

---

## Source files

- Frontend chatbot panel: `app/components/ChatbotPanel.tsx`
- Stream route: `app/api/ai/ask/stream/route.ts`
- Shared runtime: `packages/conversational-ai-core/`
- Registry: `packages/ai-intelligence-core/src/registry.ts` (capability `conversational`, status `live`)
